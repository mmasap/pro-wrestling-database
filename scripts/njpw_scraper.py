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

        CREATE TABLE IF NOT EXISTS titles (
            id   INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );

        INSERT OR IGNORE INTO titles (name) VALUES
            ('IWGPヘビー級王座'),
            ('IWGP世界ヘビー級王座'),
            ('IWGP GLOBALヘビー級王座'),
            ('IWGPジュニアヘビー級王座'),
            ('NEVER無差別級王座'),
            ('STRONG無差別級王座'),
            ('NJPW WORLD認定TV王座'),
            ('IWGP女子王座'),
            ('STRONG女子王座'),
            ('NEVER無差別級6人タッグ王座'),
            ('IWGPタッグ王座'),
            ('IWGPジュニアタッグ王座'),
            ('STRONG無差別級タッグ王座');

        CREATE TABLE IF NOT EXISTS matches (
            id           INTEGER PRIMARY KEY,
            event_id     INTEGER REFERENCES events(id),
            match_number TEXT,
            match_type   TEXT,
            time_seconds INTEGER,
            finish       TEXT
        );

        CREATE TABLE IF NOT EXISTS match_titles (
            match_id INTEGER REFERENCES matches(id),
            title_id INTEGER REFERENCES titles(id),
            PRIMARY KEY (match_id, title_id)
        );

        CREATE TABLE IF NOT EXISTS match_participants (
            match_id  INTEGER REFERENCES matches(id),
            player_id INTEGER REFERENCES players(id),
            side      TEXT,
            role      TEXT,
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


def find_title_ids(conn: sqlite3.Connection, sub_title: str) -> list[int]:
    rows = conn.execute(
        "SELECT id FROM titles WHERE ? LIKE '%' || REPLACE(name, '王座', '') || '%'",
        (sub_title,),
    ).fetchall()
    return [row[0] for row in rows]


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


def upsert_match_titles(conn: sqlite3.Connection, match_id: int, title_ids: list[int]) -> None:
    conn.execute("DELETE FROM match_titles WHERE match_id = ?", (match_id,))
    for title_id in title_ids:
        conn.execute(
            "INSERT OR IGNORE INTO match_titles (match_id, title_id) VALUES (?, ?)",
            (match_id, title_id),
        )


def upsert_match_participant(conn: sqlite3.Connection, match_id: int, player_id: int, side: str, role: str | None, is_winner: bool, is_loser: bool) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO match_participants (match_id, player_id, side, role, is_winner, is_loser)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (match_id, player_id, side, role, 1 if is_winner else 0, 1 if is_loser else 0),
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


def _parse_role(label: str | None) -> str | None:
    if not label:
        return None
    if "チャンピオン" in label or "champion" in label.lower():
        return "champion"
    if "チャレンジャー" in label or "challenger" in label.lower():
        return "challenger"
    return None


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
    lose_ids = set(str(p) for p in (card.get("lose_decision") or []))

    # 各ポジションのラベル (セパレータで区切られた1チーム目, 2チーム目)
    position_labels = [
        (card.get("left_team"),        card.get("left_team2")),
        (card.get("right_team"),       card.get("right_team2")),
        (card.get("left_bottom_team"), card.get("left_bottom_team2")),
        (card.get("right_bottom_team"),card.get("right_bottom_team2")),
    ]

    all_teams = []      # list of (team_players, role)
    for pos_idx, pos_list in enumerate([
        card.get("players_top_left_list") or [],
        card.get("players_top_right_list") or [],
        card.get("players_bottom_left_list") or [],
        card.get("players_bottom_right_list") or [],
    ]):
        sub_teams = split_by_separator(pos_list)
        labels = position_labels[pos_idx]
        for sub_idx, team in enumerate(sub_teams):
            label = labels[sub_idx] if sub_idx < len(labels) else None
            all_teams.append((team, _parse_role(label)))

    participants = []
    for team_index, (team, role) in enumerate(all_teams, start=1):
        for player in team:
            participants.append({
                "id": player["id"],
                "name": player["name"],
                "side": f"team_{team_index}",
                "role": role,
                "is_winner": str(player["id"]) in win_ids,
                "is_loser": str(player["id"]) in lose_ids,
            })

    is_title = any(p["role"] in ("champion", "challenger") for p in participants)
    title_name = (card.get("sub_title") or None) if is_title else None

    return {
        "id": card["post_id"],
        "event_id": card["tournament_post_id"],
        "match_number": card.get("result_title", ""),
        "match_type": determine_match_type([t for t, _ in all_teams]),
        "title_name": title_name,
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
        title_ids = find_title_ids(conn, match["title_name"]) if match["title_name"] else []
        upsert_match(conn, match)
        upsert_match_titles(conn, match["id"], title_ids)

        winners = [p for p in match["participants"] if p["is_winner"]]
        losers = [p for p in match["participants"] if not p["is_winner"]]

        for p in match["participants"]:
            upsert_player(conn, p["id"], p["name"])
            upsert_match_participant(conn, match["id"], p["id"], p["side"], p["role"], p["is_winner"], p["is_loser"])

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
