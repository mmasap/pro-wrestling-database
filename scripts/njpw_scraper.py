#!/usr/bin/env python3
"""NJPW 試合結果スクレイパー

Usage:
    python scripts/njpw_scraper.py YYYYMM [--db FILE]

Example:
    python scripts/njpw_scraper.py 202603
"""

import argparse
import json
import os
import re
import sqlite3
import urllib.request
from urllib.error import URLError


API_BASE = "https://app.njpw.co.jp/tournament"
CALENDAR_BASE = "https://app.njpw.co.jp/event-calendar"

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.join(_PROJECT_ROOT, "njpw.db")


def fetch_event_ids_for_month(yyyymm: str) -> list:
    """指定月の試合結果済みイベントIDを返す (fought=1 のMatchのみ)"""
    url = f"{CALENDAR_BASE}/{yyyymm}/event.json"
    events = fetch_json(url)
    return [
        str(e["post_id"])
        for e in events
        if e.get("category_name") == "Match" and e.get("fought") == 1
    ]



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
            spectators INTEGER
        );

        CREATE TABLE IF NOT EXISTS matches (
            id           INTEGER PRIMARY KEY,
            event_id     INTEGER REFERENCES events(id),
            match_number TEXT,
            match_type   TEXT,
            time_seconds INTEGER,
            finish       TEXT
        );

        CREATE TABLE IF NOT EXISTS match_participants (
            match_id  INTEGER REFERENCES matches(id),
            player_id INTEGER REFERENCES players(id),
            side      TEXT,
            is_winner INTEGER NOT NULL DEFAULT 0,
            is_loser  INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (match_id, player_id)
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
           (id, event_id, match_number, match_type, time_seconds, finish)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            match["id"],
            match["event_id"],
            match["match_number"],
            match["match_type"],
            match["time_seconds"],
            match["finish"],
        ),
    )


def upsert_match_participant(conn: sqlite3.Connection, match_id: int, player_id: int, side: str, is_winner: bool, is_loser: bool) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO match_participants (match_id, player_id, side, is_winner, is_loser)
           VALUES (?, ?, ?, ?, ?)""",
        (match_id, player_id, side, 1 if is_winner else 0, 1 if is_loser else 0),
    )


def parse_time_seconds(time_str: str) -> int:
    m = re.search(r'(\d+)分(\d+)秒', time_str or "")
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    return 0


def _parse_spectators(value) -> int | None:
    if value is None:
        return None
    m = re.search(r'[\d,]+', str(value))
    if not m:
        return None
    return int(m.group().replace(",", ""))


def determine_match_type(left_team: list, right_team: list) -> str:
    count = max(len(left_team), len(right_team))
    if count <= 1:
        return "singles"
    if count == 2:
        return "tag"
    if count == 3:
        return "6man_tag"
    return f"{count * 2}man_tag"


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
        "spectators": _parse_spectators(posts_data.get("spectators")),
    }


def parse_match_result(card: dict) -> dict:
    win_ids = set(str(p) for p in (card.get("wins_decision") or []))
    lose_ids = set(str(p) for p in (card.get("loses_decision") or []))

    top_left = card.get("players_top_left_list") or []
    bottom_left = card.get("players_bottom_left_list") or []
    top_right = card.get("players_top_right_list") or []
    bottom_right = card.get("players_bottom_right_list") or []

    left_team = top_left + bottom_left
    right_team = top_right + bottom_right

    participants = []
    for player in left_team:
        participants.append({
            "id": player["id"],
            "name": player["name"],
            "side": "left",
            "is_winner": str(player["id"]) in win_ids,
            "is_loser": str(player["id"]) in lose_ids,
        })
    for player in right_team:
        participants.append({
            "id": player["id"],
            "name": player["name"],
            "side": "right",
            "is_winner": str(player["id"]) in win_ids,
            "is_loser": str(player["id"]) in lose_ids,
        })

    return {
        "id": card["post_id"],
        "event_id": card["tournament_post_id"],
        "match_number": card.get("result_title", ""),
        "match_type": determine_match_type(left_team, right_team),
        "time_seconds": parse_time_seconds(card.get("time", "")),
        "finish": card.get("decided_technique", ""),
        "participants": participants,
    }


def _format_team(players: list) -> str:
    return " & ".join(p["name"] for p in players)


def process_event(event_id: str, conn: sqlite3.Connection) -> None:
    """1大会分の情報を取得してDBに保存する"""
    print(f"\n[{event_id}] 大会情報を取得中...")
    posts_data = fetch_json(f"{API_BASE}/posts/{event_id}.json")
    event = parse_event_info(posts_data)
    print(f"  大会: {event['title']} ({event['date']})")

    cards = fetch_json(f"{API_BASE}/card_results/{event_id}.json")
    match_cards = [c for c in cards if c.get("wins_decision")]
    print(f"  試合数: {len(match_cards)}")

    upsert_event(conn, event)
    for card in match_cards:
        match = parse_match_result(card)
        upsert_match(conn, match)

        winners = [p for p in match["participants"] if p["is_winner"]]
        losers = [p for p in match["participants"] if not p["is_winner"]]

        for p in match["participants"]:
            upsert_player(conn, p["id"], p["name"])
            upsert_match_participant(conn, match["id"], p["id"], p["side"], p["is_winner"], p["is_loser"])

        winner_str = _format_team(winners) if winners else "?"
        loser_str = _format_team(losers) if losers else "?"
        print(f"    [{match['match_type']}] {match['match_number']}: {winner_str} def. {loser_str} ({match['finish']} {match['time_seconds']}秒)")
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="NJPW 試合結果をDBに保存")
    parser.add_argument("month", metavar="YYYYMM", help="対象年月 (例: 202603)")
    parser.add_argument("--db", default=DEFAULT_DB, help=f"SQLiteファイルパス (デフォルト: {DEFAULT_DB})")
    args = parser.parse_args()

    with sqlite3.connect(args.db) as conn:
        init_db(conn)

        print(f"{args.month} の試合結果済みイベントを取得中...")
        event_ids = fetch_event_ids_for_month(args.month)
        print(f"対象イベント数: {len(event_ids)}")
        for event_id in event_ids:
            process_event(event_id, conn)

    print(f"\nDB保存完了: {args.db}")


if __name__ == "__main__":
    main()
