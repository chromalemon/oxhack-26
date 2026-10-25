import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_model import ACTION_LABELS, build_samples, event_features, match_passes_filters, predict, softmax, train


class TrainerTests(unittest.TestCase):
    def test_event_features_normalize_statsbomb_coordinates(self):
        features = event_features({"location": [60, 40], "period": 1, "minute": 45}, {"freeze_frame": [{"teammate": False, "location": [66, 40]}]})
        self.assertEqual(features[:4], [0.5, 0.5, 0.5, 1.0])
        self.assertGreater(features[6], 0)
        self.assertLess(features[7], 1)

    def test_build_samples_uses_next_same_team_action(self):
        events = [
            {"type": {"name": "Ball Receipt*"}, "location": [30, 40], "period": 1, "team": {"id": 1}},
            {"type": {"name": "Pass"}, "location": [40, 40], "period": 1, "team": {"id": 2}},
            {"type": {"name": "Carry"}, "location": [50, 40], "period": 1, "team": {"id": 1}},
        ]
        self.assertEqual(build_samples(events)[0][1], "Carry")

    def test_player_filter_selects_actions_by_player_name(self):
        events = [
            {"type": {"name": "Ball Receipt*"}, "location": [30, 40], "period": 1, "team": {"id": 1}},
            {"type": {"name": "Carry"}, "location": [50, 40], "period": 1, "team": {"id": 1}, "player": {"name": "Alex Forward"}},
            {"type": {"name": "Pass"}, "location": [60, 40], "period": 1, "team": {"id": 1}, "player": {"name": "Other Player"}},
        ]
        self.assertEqual(build_samples(events, player="Alex Forward")[0][1], "Carry")
        self.assertEqual(build_samples(events, player="Other Player")[0][1], "Pass")

    def test_trained_probabilities_are_a_distribution(self):
        samples = [([0.2, 0.5, 0.8, 1.0, 0.2, 0.1, 0.1, 0.5, 0.1], "Pass")] * 8 + [([0.8, 0.5, 0.2, 1.0, 0.2, 0.1, 0.1, 0.5, 0.1], "Shot")] * 8
        weights, bias = train(samples, epochs=10)
        probabilities = predict(samples[0][0], weights, bias)
        self.assertEqual(len(probabilities), len(ACTION_LABELS))
        self.assertAlmostEqual(sum(probabilities), 1.0)

    def test_softmax_is_stable_for_large_logits(self):
        self.assertAlmostEqual(sum(softmax([1000, 1001, 999])), 1.0)

    def test_match_filters_keep_requested_team_and_league(self):
        match = {"competition": {"competition_name": "Bundesliga"}, "home_team": {"home_team_name": "Bayer Leverkusen"}, "away_team": {"away_team_name": "Bayern Munich"}}
        self.assertTrue(match_passes_filters(match, league="Bundesliga", team="Bayern Munich"))
        self.assertFalse(match_passes_filters(match, league="Premier League"))
        self.assertFalse(match_passes_filters(match, team="Arsenal"))


if __name__ == "__main__":
    unittest.main()
