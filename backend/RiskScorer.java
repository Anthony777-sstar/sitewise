public class RiskScorer {

    // Weights: budget 30%, timeline 25%, safety 25%, resources 20%
    private static final double WEIGHT_BUDGET = 0.30;
    private static final double WEIGHT_TIMELINE = 0.25;
    private static final double WEIGHT_SAFETY = 0.25;
    private static final double WEIGHT_RESOURCES = 0.20;

    private int budget;
    private int timeline;
    private int safety;
    private int resources;

    public RiskScorer(int budget, int timeline, int safety, int resources) {
        this.budget = clamp(budget);
        this.timeline = clamp(timeline);
        this.safety = clamp(safety);
        this.resources = clamp(resources);
    }

    private int clamp(int value) {
        return Math.max(1, Math.min(10, value));
    }

    // Higher input = higher risk, so raw weighted sum is already 1-10
    // Scale to 0-100: ((weightedSum - 1) / 9) * 100
    public int calculateScore() {
        double weightedSum = budget * WEIGHT_BUDGET
                           + timeline * WEIGHT_TIMELINE
                           + safety * WEIGHT_SAFETY
                           + resources * WEIGHT_RESOURCES;
        return (int) Math.round(((weightedSum - 1.0) / 9.0) * 100.0);
    }

    public String getRiskLabel(int score) {
        if (score <= 40) return "LOW";
        if (score <= 70) return "MEDIUM";
        return "HIGH";
    }

    // Returns all factors as a JSON-like string for embedding in the response
    public String getFactorsJson() {
        return "{\"budget\":" + budget + ",\"timeline\":" + timeline
             + ",\"safety\":" + safety + ",\"resources\":" + resources + "}";
    }
}
