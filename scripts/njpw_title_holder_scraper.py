#!/usr/bin/env python3
"""NJPW タイトル保持者スクレイパー

Usage:
    python scripts/njpw_title_holder_scraper.py [--title TITLE_ID] [--db FILE]

Example:
    python scripts/njpw_title_holder_scraper.py --title iwgp
"""

import argparse
import json
import os
import sqlite3
import urllib.request
from urllib.error import URLError

API_BASE = "https://app.njpw.co.jp/champions/pagination"

DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "njpw.db")


def fetch_json(url: str) -> dict:
    try:
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode())
    except URLError as e:
        raise RuntimeError(f"取得失敗: {url} — {e}")


def fetch_all_pages(slug: str) -> list:
    """全ページのpostsを取得して結合して返す (AllCountはページ数)"""
    all_posts = []
    page = 1
    while True:
        url = f"{API_BASE}/{slug}/{page}.json"
        print(f"  取得中: {url}")
        data = fetch_json(url)
        posts = data.get("posts", [])
        if not posts:
            break
        all_posts.extend(posts)
        total_pages = data.get("AllCount", 0)
        if page >= total_pages:
            break
        page += 1
    return all_posts


def _parse_match_row(match: dict) -> tuple:
    finish = match.get("finish")
    time = match.get("time")
    date_raw = match.get("date", "")
    date = date_raw[:10] if date_raw else None
    stadium_name = match.get("stadium_name")
    result_url = match.get("result_url")
    opponents_raw = match.get("opponents") or []
    opponents = json.dumps([o["name"] for o in opponents_raw], ensure_ascii=False)
    return finish, time, date, stadium_name, result_url, opponents


def ensure_wrestler(conn: sqlite3.Connection, profile: dict) -> None:
    """wrestlers テーブルに存在しなければ登録する"""
    wrestler_id = profile.get("post_id")
    name = profile.get("name") or ""
    if not wrestler_id:
        return
    conn.execute(
        """INSERT OR IGNORE INTO wrestlers (id, organization_id, name, name_kana)
           VALUES (?, 'njpw', ?, '')""",
        (wrestler_id, name),
    )


def upsert_title_holder(conn: sqlite3.Connection, title_id: str, post: dict) -> None:
    era_title = post["era_title"]
    profiles = post.get("profiles") or []
    wrestler_id = None
    if profiles and profiles[0].get("post_id"):
        wrestler_id = profiles[0]["post_id"]
        ensure_wrestler(conn, profiles[0])

    conn.execute(
        "INSERT OR REPLACE INTO title_holders (title_id, era_title, wrestler_id) VALUES (?, ?, ?)",
        (title_id, era_title, wrestler_id),
    )

    # 既存の試合データを削除して再投入
    conn.execute(
        "DELETE FROM title_holder_matches WHERE title_id = ? AND era_title = ?",
        (title_id, era_title),
    )

    all_matches = [post.get("title_match") or {}] + (post.get("defenses") or [])
    for match in all_matches:
        if not match:
            continue
        finish, time, date, stadium_name, result_url, opponents = _parse_match_row(match)
        conn.execute(
            """INSERT INTO title_holder_matches
               (title_id, era_title, finish, time, date, stadium_name, result_url, opponents)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (title_id, era_title, finish, time, date, stadium_name, result_url, opponents),
        )


def process_title(title_id: str, conn: sqlite3.Connection) -> None:
    print(f"\n[{title_id}] タイトル保持者情報を取得中...")
    posts = fetch_all_pages(title_id)
    print(f"  取得件数: {len(posts)} エラ")

    for post in posts:
        era = post["era_title"]
        profiles = post.get("profiles") or []
        champion_name = profiles[0]["name"] if profiles else "不明"
        print(f"  第{era}代: {champion_name}")
        upsert_title_holder(conn, title_id, post)

    conn.commit()
    print(f"  保存完了: {len(posts)} エラ")


def apply_migrations(conn: sqlite3.Connection) -> None:
    """title_holders / title_holder_matches テーブルがなければ作成する"""
    conn.execute("DROP TABLE IF EXISTS title_holder_matches")
    conn.execute("DROP TABLE IF EXISTS title_holders")
    conn.execute("DROP TABLE IF EXISTS title_reign_defenses")
    conn.execute("DROP TABLE IF EXISTS title_reigns")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS title_holders (
            title_id TEXT NOT NULL,
            era_title INTEGER NOT NULL,
            wrestler_id INTEGER,
            PRIMARY KEY (title_id, era_title),
            FOREIGN KEY (title_id) REFERENCES titles(id),
            FOREIGN KEY (wrestler_id) REFERENCES wrestlers(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS title_holder_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title_id TEXT NOT NULL,
            era_title INTEGER NOT NULL,
            finish TEXT,
            time TEXT,
            date TEXT,
            stadium_name TEXT,
            result_url TEXT,
            opponents TEXT
        )
    """)
    conn.commit()


def get_njpw_title_ids(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT id FROM titles WHERE organization_id = 'njpw' ORDER BY display_order IS NULL, display_order"
    ).fetchall()
    return [r[0] for r in rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="NJPW タイトル保持者情報をDBに保存")
    parser.add_argument(
        "--title",
        default=None,
        help="対象タイトルID (省略時はtitlesテーブルのNJPW全タイトルを処理)",
    )
    parser.add_argument("--db", default=DEFAULT_DB, help=f"SQLiteファイルパス (デフォルト: {DEFAULT_DB})")
    args = parser.parse_args()

    with sqlite3.connect(args.db) as conn:
        apply_migrations(conn)

        if args.title:
            title_ids = [args.title]
        else:
            title_ids = get_njpw_title_ids(conn)
            if not title_ids:
                print("[ERROR] titlesテーブルにNJPWのタイトルが登録されていません")
                return
            print(f"対象タイトル ({len(title_ids)} 件): {', '.join(title_ids)}")

        for title_id in title_ids:
            process_title(title_id, conn)

    print(f"\nDB保存完了: {args.db}")


if __name__ == "__main__":
    main()
