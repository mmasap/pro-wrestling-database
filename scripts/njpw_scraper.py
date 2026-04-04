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
TEAM_SEPARATOR_ID = 77849

DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "njpw.db")


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



def upsert_player(conn: sqlite3.Connection, player_id: int, name: str, organization_id: int) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO players (id, name, organization_id) VALUES (?, ?, ?)",
        (player_id, name, organization_id),
    )


def upsert_event(conn: sqlite3.Connection, event: dict, organization_id: int) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO events (id, name, date, prefecture, arena, spectators, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (event["id"], event["name"], event["date"], event["prefecture"], event["arena"], event["spectators"], organization_id),
    )


def find_title_ids(conn: sqlite3.Connection, sub_title: str) -> list[int]:
    rows = conn.execute(
        "SELECT id FROM titles WHERE ? LIKE '%' || REPLACE(name, '王座', '') || '%'",
        (sub_title,),
    ).fetchall()
    return [row[0] for row in rows]


def upsert_match(conn: sqlite3.Connection, match: dict) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO matches
           (id, event_id, match_number, time_seconds, finish)
           VALUES (?, ?, ?, ?, ?)""",
        (
            match["id"],
            match["event_id"],
            match["match_number"],
            match["time_seconds"],
            match["finish"],
        ),
    )


def upsert_match_titles(conn: sqlite3.Connection, match_id: int, title_ids: list[int]) -> None:
    conn.execute("DELETE FROM match_titles WHERE match_id = ?", (match_id,))
    for title_id in title_ids:
        conn.execute(
            "INSERT OR IGNORE INTO match_titles (match_id, title_id) VALUES (?, ?)",
            (match_id, title_id),
        )


def upsert_match_participant(conn: sqlite3.Connection, match_id: int, player_id: int, team: int, is_winner: bool, is_loser: bool) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO match_participants (match_id, player_id, team, is_winner, is_loser)
           VALUES (?, ?, ?, ?, ?)""",
        (match_id, player_id, team, 1 if is_winner else 0, 1 if is_loser else 0),
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



def split_by_separator(player_list: list) -> list[list]:
    """セパレータID(77849)でリストを複数チームに分割する"""
    teams, current = [], []
    for player in player_list:
        if player["id"] == TEAM_SEPARATOR_ID:
            if current:
                teams.append(current)
                current = []
        else:
            current.append(player)
    if current:
        teams.append(current)
    return teams


def determine_match_type(teams: list[list]) -> str:
    active = [t for t in teams if t]
    team_count = len(active)
    team_size = max(len(t) for t in active) if active else 1

    if team_count <= 2:
        if team_size == 1:
            return "singles"
        if team_size == 2:
            return "tag"
        if team_size == 3:
            return "6man_tag"
        return f"{team_size * 2}man_tag"
    else:
        if team_size == 1:
            return f"{team_count}way"
        return f"{team_count}way_tag"


def parse_event_info(posts_data: dict) -> dict:
    date_raw = posts_data.get("event_start_date", "")
    date = date_raw[:10] if date_raw else ""
    venue_info = posts_data.get("venue") or {}
    venue_str = venue_info.get("stadium_name", "")
    if "・" in venue_str:
        prefecture, arena = venue_str.split("・", 1)
    else:
        prefecture, arena = "", venue_str
    name = posts_data.get("schedule_title", "")
    name = name.split(" – ")[0].strip()
    return {
        "id": posts_data["post_id"],
        "name": name,
        "date": date,
        "prefecture": prefecture,
        "arena": arena,
        "spectators": _parse_spectators(posts_data.get("spectators")),
    }


def parse_match_result(card: dict) -> dict:
    win_ids = set(str(p) for p in (card.get("wins_decision") or []))
    lose_ids = set(str(p) for p in (card.get("lose_decision") or []))

    all_teams = []
    for pos_list in [
        card.get("players_top_left_list") or [],
        card.get("players_top_right_list") or [],
        card.get("players_bottom_left_list") or [],
        card.get("players_bottom_right_list") or [],
    ]:
        all_teams.extend(split_by_separator(pos_list))

    participants = []
    for team_index, team in enumerate(all_teams, start=1):
        for player in team:
            participants.append({
                "id": player["id"],
                "name": player["name"],
                "team": team_index,
                "is_winner": str(player["id"]) in win_ids,
                "is_loser": str(player["id"]) in lose_ids,
            })

    title_name = card.get("sub_title") or None

    result_title = card.get("result_title", "")
    match_number_m = re.search(r'\d+', result_title)
    match_number = int(match_number_m.group()) if match_number_m else None

    return {
        "id": card["post_id"],
        "event_id": card["tournament_post_id"],
        "match_number": match_number,
        "title_name": title_name,
        "time_seconds": parse_time_seconds(card.get("time", "")),
        "finish": card.get("decided_technique", ""),
        "participants": participants,
    }


def _format_team(players: list) -> str:
    return " & ".join(p["name"] for p in players)


def process_event(event_id: str, conn: sqlite3.Connection, organization_id: int) -> None:
    """1大会分の情報を取得してDBに保存する"""
    print(f"\n[{event_id}] 大会情報を取得中...")
    posts_data = fetch_json(f"{API_BASE}/posts/{event_id}.json")
    event = parse_event_info(posts_data)
    print(f"  大会: {event['name']} ({event['date']})")

    cards = fetch_json(f"{API_BASE}/card_results/{event_id}.json")
    match_cards = [c for c in cards if c.get("wins_decision")]
    print(f"  試合数: {len(match_cards)}")

    upsert_event(conn, event, organization_id)
    for card in match_cards:
        match = parse_match_result(card)
        title_ids = find_title_ids(conn, match["title_name"]) if match["title_name"] else []
        upsert_match(conn, match)
        upsert_match_titles(conn, match["id"], title_ids)

        winners = [p for p in match["participants"] if p["is_winner"]]
        losers = [p for p in match["participants"] if not p["is_winner"]]

        for p in match["participants"]:
            upsert_player(conn, p["id"], p["name"], organization_id)
            upsert_match_participant(conn, match["id"], p["id"], p["team"], p["is_winner"], p["is_loser"])

        winner_str = _format_team(winners) if winners else "?"
        loser_str = _format_team(losers) if losers else "?"
        print(f"    {match['match_number']}: {winner_str} def. {loser_str} ({match['finish']} {match['time_seconds']}秒)")
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="NJPW 試合結果をDBに保存")
    parser.add_argument("month", metavar="YYYYMM", help="対象年月 (例: 202603)")
    parser.add_argument("--db", default=DEFAULT_DB, help=f"SQLiteファイルパス (デフォルト: {DEFAULT_DB})")
    args = parser.parse_args()

    with sqlite3.connect(args.db) as conn:
        organization_id = conn.execute(
            "SELECT id FROM organizations WHERE name = '新日本プロレス'"
        ).fetchone()[0]

        print(f"{args.month} の試合結果済みイベントを取得中...")
        event_ids = fetch_event_ids_for_month(args.month)
        print(f"対象イベント数: {len(event_ids)}")
        for event_id in event_ids:
            process_event(event_id, conn, organization_id)

    print(f"\nDB保存完了: {args.db}")


if __name__ == "__main__":
    main()
