import unittest

from playmaker.model.train_model import ACTION_LABELS, build_samples, event_features, predict, softmax, train


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

    def test_trained_probabilities_are_a_distribution(self):
        samples = [([0.2, 0.5, 0.8, 1.0, 0.2, 0.1, 0.1, 0.5, 0.1], "Pass")] * 8 + [([0.8, 0.5, 0.2, 1.0, 0.2, 0.1, 0.1, 0.5, 0.1], "Shot")] * 8
        weights, bias = train(samples, epochs=10)
        probabilities = predict(samples[0][0], weights, bias)
        self.assertEqual(len(probabilities), len(ACTION_LABELS))
        self.assertAlmostEqual(sum(probabilities), 1.0)

    def test_softmax_is_stable_for_large_logits(self):
        self.assertAlmostEqual(sum(softmax([1000, 1001, 999])), 1.0)


if __name__ == "__main__":
    unittest.main()