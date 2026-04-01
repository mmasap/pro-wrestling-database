#!/usr/bin/env python3
"""NJPW シングルマッチ結果スクレイパー

Usage:
    python scraper.py <URL> [--db FILE]

Example:
    python scraper.py https://www.njpw.co.jp/tournament/result/624064
"""

import argparse
import json
import re
import sqlite3
import urllib.request
from urllib.error import URLError


API_BASE = "https://app.njpw.co.jp/tournament"
CALENDAR_BASE = "https://app.njpw.co.jp/event-calendar"


def fetch_event_ids_for_month(yyyymm: str) -> list:
    """指定月の試合結果済みイベントIDを返す (fought=1 のMatchのみ)"""
    url = f"{CALENDAR_BASE}/{yyyymm}/event.json"
    events = fetch_json(url)
    return [
        str(e["post_id"])
        for e in events
        if e.get("category_name") == "Match" and e.get("fought") == 1
    ]


def extract_event_id(url: str) -> str:
    m = re.search(r'/(\d+)/?$', url.rstrip('/'))
    if not m:
        raise ValueError(f"URLからイベントIDを取得できません: {url}")
    return m.group(1)


def fetch_json(url: str) -> dict:
    try:
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode())
    except URLError as e:
        raise RuntimeError(f"取得失敗: {url} — {e}")


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS players (
            id   INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
            id         INTEGER PRIMARY KEY,
            title      TEXT,
            date       TEXT,
            prefecture TEXT,
            arena      TEXT,
            spectators TEXT
        );

        CREATE TABLE IF NOT EXISTS matches (
            id           INTEGER PRIMARY KEY,
            event_id     INTEGER REFERENCES events(id),
            match_number TEXT,
            winner_id    INTEGER REFERENCES players(id),
            loser_id     INTEGER REFERENCES players(id),
            time_seconds INTEGER,
            finish       TEXT
        );
    """)
    conn.commit()


def upsert_player(conn: sqlite3.Connection, player_id: int, name: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO players (id, name) VALUES (?, ?)",
        (player_id, name),
    )


def upsert_event(conn: sqlite3.Connection, event: dict) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO events (id, title, date, prefecture, arena, spectators) VALUES (?, ?, ?, ?, ?, ?)",
        (event["id"], event["title"], event["date"], event["prefecture"], event["arena"], event["spectators"]),
    )


def upsert_match(conn: sqlite3.Connection, match: dict) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO matches
           (id, event_id, match_number, winner_id, loser_id, time_seconds, finish)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            match["id"],
            match["event_id"],
            match["match_number"],
            match["winner_id"],
            match["loser_id"],
            match["time_seconds"],
            match["finish"],
        ),
    )


def is_single_match(card: dict) -> bool:
    left = card.get("players_top_left_list") or []
    right = card.get("players_top_right_list") or []
    bottom_left = card.get("players_bottom_left_list") or []
    bottom_right = card.get("players_bottom_right_list") or []
    return len(left) == 1 and len(right) == 1 and not bottom_left and not bottom_right


def parse_time_seconds(time_str: str) -> int:
    m = re.search(r'(\d+)分(\d+)秒', time_str or "")
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    return 0


def parse_event_info(posts_data: dict) -> dict:
    date_raw = posts_data.get("event_start_date", "")
    date = date_raw[:10] if date_raw else ""
    venue_info = posts_data.get("venue") or {}
    venue_str = venue_info.get("stadium_name", "")
    if "・" in venue_str:
        prefecture, arena = venue_str.split("・", 1)
    else:
        prefecture, arena = "", venue_str
    title = posts_data.get("schedule_title", "")
    title = title.split(" – ")[0].strip()
    return {
        "id": posts_data["post_id"],
        "title": title,
        "date": date,
        "prefecture": prefecture,
        "arena": arena,
        "spectators": posts_data.get("spectators", ""),
    }


def parse_match_result(card: dict) -> dict:
    win_ids = set(card.get("wins_decision") or [])
    left = card.get("players_top_left_list") or []
    right = card.get("players_top_right_list") or []

    left_wins = any(str(p["id"]) in win_ids for p in left)
    winner = left[0] if left_wins else right[0]
    loser = right[0] if left_wins else left[0]

    return {
        "id": card["post_id"],
        "event_id": card["tournament_post_id"],
        "match_number": card.get("result_title", ""),
        "winner_id": winner["id"],
        "winner_name": winner["name"],
        "loser_id": loser["id"],
        "loser_name": loser["name"],
        "time_seconds": parse_time_seconds(card.get("time", "")),
        "finish": card.get("decided_technique", ""),
    }


def process_event(event_id: str, conn: sqlite3.Connection) -> None:
    """1大会分の情報を取得してDBに保存する"""
    print(f"\n[{event_id}] 大会情報を取得中...")
    posts_data = fetch_json(f"{API_BASE}/posts/{event_id}.json")
    event = parse_event_info(posts_data)
    print(f"  大会: {event['title']} ({event['date']})")

    cards = fetch_json(f"{API_BASE}/card_results/{event_id}.json")
    singles = [c for c in cards if is_single_match(c)]
    print(f"  シングルマッチ: {len(singles)}試合")

    upsert_event(conn, event)
    for card in singles:
        match = parse_match_result(card)
        upsert_player(conn, match["winner_id"], match["winner_name"])
        upsert_player(conn, match["loser_id"], match["loser_name"])
        upsert_match(conn, match)
        print(f"    {match['match_number']}: {match['winner_name']} def. {match['loser_name']} ({match['finish']} {match['time_seconds']}秒)")
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="NJPW シングルマッチ結果をDBに保存")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("url", nargs="?", help="大会URL (例: https://www.njpw.co.jp/tournament/result/624064)")
    group.add_argument("--month", metavar="YYYYMM", help="指定月の全試合結果を取得 (例: 202603)")
    parser.add_argument("--db", default="njpw.db", help="SQLiteファイルパス (デフォルト: njpw.db)")
    args = parser.parse_args()

    with sqlite3.connect(args.db) as conn:
        init_db(conn)

        if args.month:
            print(f"{args.month} の試合結果済みイベントを取得中...")
            event_ids = fetch_event_ids_for_month(args.month)
            print(f"対象イベント数: {len(event_ids)}")
            for event_id in event_ids:
                process_event(event_id, conn)
        else:
            event_id = extract_event_id(args.url)
            process_event(event_id, conn)

    print(f"\nDB保存完了: {args.db}")


if __name__ == "__main__":
    main()
