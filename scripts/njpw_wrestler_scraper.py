#!/usr/bin/env python3
"""NJPW レスラー情報スクレイパー

Usage:
    python scripts/njpw_wrestler_scraper.py [--db FILE]

Example:
    python scripts/njpw_wrestler_scraper.py
"""

import argparse
import json
import os
import re
import sqlite3
import time
import urllib.request
from urllib.error import URLError

LIST_URL = "https://app.njpw.co.jp/profile/list/all.json"
DETAIL_URL = "https://app.njpw.co.jp/profile/posts/{id}.json"

DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "njpw.db")


def fetch_json(url: str) -> dict:
    try:
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode())
    except URLError as e:
        raise RuntimeError(f"取得失敗: {url} — {e}")


def parse_cm(value: str) -> int | None:
    m = re.search(r'(\d+)', value or "")
    return int(m.group(1)) if m else None


def parse_kg(value: str) -> int | None:
    m = re.search(r'(\d+)', value or "")
    return int(m.group(1)) if m else None


def parse_date(value: str) -> str | None:
    """'YYYY年M月D日' を 'YYYY-MM-DD' に変換。年月日が揃っていない場合は None を返す。"""
    m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', value or "")
    if not m:
        return None
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def upsert_wrestler(conn: sqlite3.Connection, wrestler: dict, organization_id: str) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO wrestlers
           (id, organization_id, name, name_kana, birthday, birthplace, debut, height, weight, theme_music)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            wrestler["id"],
            organization_id,
            wrestler["name"],
            wrestler["name_kana"],
            wrestler.get("birthday"),
            wrestler.get("birthplace"),
            wrestler.get("debut"),
            wrestler.get("height"),
            wrestler.get("weight"),
            wrestler.get("theme_music"),
        ),
    )
    conn.execute("DELETE FROM wrestler_units WHERE wrestler_id = ?", (wrestler["id"],))
    unit_slug = wrestler.get("unit")
    if unit_slug:
        try:
            conn.execute(
                "INSERT INTO wrestler_units (wrestler_id, unit_id) VALUES (?, ?)",
                (wrestler["id"], unit_slug),
            )
        except sqlite3.IntegrityError:
            unit_slug = None
    if not unit_slug:
        conn.execute(
            "INSERT OR IGNORE INTO wrestler_units (wrestler_id, unit_id) VALUES (?, ?)",
            (wrestler["id"], "njpw"),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="NJPW レスラー情報をwrestlersテーブルに保存")
    parser.add_argument("--db", default=DEFAULT_DB, help=f"SQLiteファイルパス (デフォルト: {DEFAULT_DB})")
    args = parser.parse_args()

    print(f"レスラー一覧を取得中: {LIST_URL}")
    wrestlers_list = fetch_json(LIST_URL)
    print(f"取得件数: {len(wrestlers_list)}")

    with sqlite3.connect(args.db) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        organization_id = str(conn.execute(
            "SELECT id FROM organizations WHERE name = '新日本プロレス'"
        ).fetchone()[0])

        for i, item in enumerate(wrestlers_list, 1):
            wrestler_id = item["post_id"]
            print(f"  [{i}/{len(wrestlers_list)}] {item['name']} (id={wrestler_id})")

            detail = fetch_json(DETAIL_URL.format(id=wrestler_id))

            wrestler = {
                "id": wrestler_id,
                "name": detail.get("name") or item["name"],
                "name_kana": detail.get("name_kana") or item.get("name_kana", ""),
                "birthday": parse_date(detail.get("birthday", "")),
                "birthplace": detail.get("birthplace") or None,
                "debut": parse_date(detail.get("debut", "")),
                "height": parse_cm(detail.get("height", "")),
                "weight": parse_kg(detail.get("weight", "")),
                "theme_music": detail.get("theme_music") or None,
                "unit": (item.get("unit") or {}).get("slug") or None,
            }
            upsert_wrestler(conn, wrestler, organization_id)

            time.sleep(0.3)

        conn.commit()

    print(f"\nDB保存完了: {args.db}")


if __name__ == "__main__":
    main()
