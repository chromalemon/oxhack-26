#!/usr/bin/env python3
"""Train a small next-action model from StatsBomb Open Data.

The trainer deliberately uses only the Python standard library so the project
can be bootstrapped in a clean environment. It predicts the next action class
from the current event's location and match context. This is a baseline model,
not a replacement for a tracking-data model.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODEL_PATH = ROOT / "model.json"
BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
COMPETITION_ID = 9
SEASON_ID = 281
ACTION_LABELS = ("Pass", "Carry", "Dribble", "Shot", "Other")
FEATURE_NAMES = ("x", "y", "forward_space", "centrality", "period", "minute", "opponent_count_15m", "nearest_opponent", "opponent_pressure")


def fetch_json(url: str, destination: Path | None = None):
    if destination and destination.exists():
        return json.loads(destination.read_text())
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.loads(response.read())
    if destination:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(payload))
    return payload


def match_passes_filters(match: dict, league: str | None = None, team: str | None = None, competition: str | None = None, player: str | None = None) -> bool:
    competition_name = (match.get("competition") or {}).get("competition_name") or match.get("competition_name")
    if league and competition_name != league:
        return False
    if competition and (match.get("competition") or {}).get("competition_name") != competition and match.get("competition_name") != competition:
        return False
    home = (match.get("home_team") or {}).get("home_team_name") or (match.get("home_team") or {}).get("name")
    away = (match.get("away_team") or {}).get("away_team_name") or (match.get("away_team") or {}).get("name")
    if team and team not in {home, away}:
        return False
    return True


def load_feedback(path: Path) -> list[tuple[list[float], str]]:
    payload = json.loads(path.read_text())
    samples = []
    for row in payload:
        features = row.get("features")
        label = row.get("label")
        if isinstance(features, list) and label in ACTION_LABELS:
            samples.append(([float(value) for value in features], label))
    return samples


def load_matches(max_matches: int, league: str | None = None, team: str | None = None, competition: str | None = None) -> list[dict]:
    matches = fetch_json(f"{BASE_URL}/matches/{COMPETITION_ID}/{SEASON_ID}.json", DATA_DIR / f"matches-{COMPETITION_ID}-{SEASON_ID}.json")
    filtered = [match for match in matches if match_passes_filters(match, league=league, team=team, competition=competition)]
    return filtered[:max_matches]


def load_events(match_id: int) -> list[dict]:
    return fetch_json(f"{BASE_URL}/events/{match_id}.json", DATA_DIR / f"events-{match_id}.json")


def load_freeze_frames(match_id: int) -> dict[str, dict]:
    frames = fetch_json(f"{BASE_URL}/three-sixty/{match_id}.json", DATA_DIR / f"three-sixty-{match_id}.json")
    return {frame["event_uuid"]: frame for frame in frames}


def action_label(event: dict) -> str:
    event_type = event.get("type", {}).get("name", "Other")
    return event_type if event_type in ACTION_LABELS[:-1] else "Other"


def event_features(event: dict, frame: dict | None = None) -> list[float] | None:
    location = event.get("location")
    if not location or len(location) < 2:
        return None
    x, y = float(location[0]) / 120, float(location[1]) / 80
    period = float(event.get("period", 1)) / 5
    minute = float(event.get("minute", 0)) / 120
    opponents = [player for player in (frame or {}).get("freeze_frame", []) if not player.get("teammate")]
    distances = [math.hypot(float(player["location"][0]) / 120 - x, float(player["location"][1]) / 80 - y) for player in opponents if player.get("location")]
    nearby_count = sum(distance <= 0.15 for distance in distances)
    nearest_opponent = min(distances, default=1.0)
    pressure = sum(1 / (1 + distance * 6) for distance in distances) / 11
    return [x, y, 1 - x, 1 - abs(y - 0.5) * 2, period, minute, nearby_count / 11, min(nearest_opponent, 1), min(pressure, 1)]


def build_samples(events: list[dict], frames: dict[str, dict] | None = None, player: str | None = None) -> list[tuple[list[float], str]]:
    samples = []
    for index, event in enumerate(events[:-1]):
        features = event_features(event, (frames or {}).get(event.get("id")))
        if features is None:
            continue
        next_event = next((candidate for candidate in events[index + 1 : index + 8] if candidate.get("team", {}).get("id") == event.get("team", {}).get("id")), None)
        if next_event is None:
            continue
        if player and (next_event.get("player") or {}).get("name", "").casefold() != player.casefold():
            continue
        samples.append((features, action_label(next_event)))
    return samples


def softmax(values: list[float]) -> list[float]:
    maximum = max(values)
    exponentials = [math.exp(value - maximum) for value in values]
    total = sum(exponentials)
    return [value / total for value in exponentials]


def train(samples: list[tuple[list[float], str]], epochs: int = 90, learning_rate: float = 0.12, seed: int = 7) -> tuple[list[list[float]], list[float]]:
    random.seed(seed)
    feature_count = len(FEATURE_NAMES)
    class_count = len(ACTION_LABELS)
    weights = [[random.uniform(-0.05, 0.05) for _ in range(feature_count)] for _ in range(class_count)]
    bias = [0.0] * class_count
    label_indices = {label: index for index, label in enumerate(ACTION_LABELS)}
    for _ in range(epochs):
        random.shuffle(samples)
        for features, label in samples:
            logits = [sum(weight * value for weight, value in zip(row, features)) + offset for row, offset in zip(weights, bias)]
            probabilities = softmax(logits)
            target = label_indices[label]
            for class_index in range(class_count):
                error = probabilities[class_index] - (1 if class_index == target else 0)
                for feature_index, value in enumerate(features):
                    weights[class_index][feature_index] -= learning_rate * error * value
                bias[class_index] -= learning_rate * error
    return weights, bias


def predict(features: list[float], weights: list[list[float]], bias: list[float]) -> list[float]:
    return softmax([sum(weight * value for weight, value in zip(row, features)) + offset for row, offset in zip(weights, bias)])


def evaluate(samples: list[tuple[list[float], str]], weights: list[list[float]], bias: list[float]) -> float:
    label_indices = {label: index for index, label in enumerate(ACTION_LABELS)}
    correct = sum(max(range(len(ACTION_LABELS)), key=lambda index: predict(features, weights, bias)[index]) == label_indices[label] for features, label in samples)
    return correct / len(samples) if samples else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-matches", type=int, default=24, help="Number of matches to download (default: 24)")
    parser.add_argument("--league", help="Keep matches from this competition name")
    parser.add_argument("--team", help="Keep matches involving this team")
    parser.add_argument("--competition", help="Keep matches from this competition name")
    parser.add_argument("--player", help="Keep next-action samples performed by this player")
    parser.add_argument("--feedback", help="Optional JSON file of labeled feature rows used to continue training")
    args = parser.parse_args()
    matches = load_matches(args.max_matches, league=args.league, team=args.team, competition=args.competition)
    all_samples = []
    loaded_matches = 0
    for match in matches:
        try:
            frames = load_freeze_frames(match["match_id"])
        except urllib.error.HTTPError:
            frames = {}
        samples = build_samples(load_events(match["match_id"]), frames, player=args.player)
        if samples:
            all_samples.extend(samples)
            loaded_matches += 1
    if args.feedback:
        all_samples.extend(load_feedback(Path(args.feedback)))
    if len(all_samples) < 50:
        raise RuntimeError(f"Only {len(all_samples)} samples were found; refusing to train a weak artifact.")
    split_index = max(1, int(len(all_samples) * 0.8))
    train_samples = all_samples[:split_index]
    test_samples = all_samples[split_index:]
    weights, bias = train(train_samples)
    artifact = {
        "model_version": "statsbomb-360-softmax-0.2",
        "source": "StatsBomb Open Data",
        "competition": "Bundesliga 2023/24",
        "matches": loaded_matches,
        "samples": len(all_samples),
        "features": list(FEATURE_NAMES),
        "labels": list(ACTION_LABELS),
        "weights": weights,
        "bias": bias,
        "test_accuracy": round(evaluate(test_samples, weights, bias), 4),
    }
    MODEL_PATH.write_text(json.dumps(artifact, indent=2) + "\n")
    print(json.dumps({key: artifact[key] for key in ("model_version", "matches", "samples", "test_accuracy")}, indent=2))


if __name__ == "__main__":
    main()
