import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class BuyingAssistantPromptService {

    private static final String PROMPTS_DIR =
        Files.isDirectory(Paths.get("prompts")) ? "prompts" : "backend/prompts";

    private String guardrails;
    private Map<String, String> guideCache;

    public BuyingAssistantPromptService() {
        guideCache = new HashMap<>();
        try {
            guardrails = readFile(PROMPTS_DIR + "/guardrails.md");
        } catch (IOException e) {
            System.err.println("WARNING: Could not load guardrails.md: " + e.getMessage());
            guardrails = "You are Sitewise's Buying Assistant.";
        }
    }

    private String readFile(String path) throws IOException {
        return new String(Files.readAllBytes(Paths.get(path)));
    }

    private String loadGuide(String intentType, String location) {
        String intent = intentType.toLowerCase().replace('_', '-');
        String loc = location.toLowerCase();
        String filename = PROMPTS_DIR + "/guide-" + intent + "-" + loc + ".md";
        if (guideCache.containsKey(filename)) {
            return guideCache.get(filename);
        }
        try {
            String content = readFile(filename);
            guideCache.put(filename, content);
            return content;
        } catch (IOException e) {
            System.err.println("WARNING: Could not load " + filename + ": " + e.getMessage());
            guideCache.put(filename, "");
            return "";
        }
    }

    public String buildSystemPrompt(String intentType, String location) {
        String guide = loadGuide(intentType, location);
        String intentLabel;
        switch (intentType) {
            case "BUY_HOUSE":
                intentLabel = "BUYING A HOUSE";
                break;
            case "BUILD_HOUSE":
                intentLabel = "BUILDING A HOUSE";
                break;
            case "BUY_LAND":
                intentLabel = "BUYING LAND";
                break;
            default:
                intentLabel = "ASSESSING A CONSTRUCTION PROJECT";
        }

        String locLabel;
        switch (location.toUpperCase()) {
            case "USA":
                locLabel = "USA";
                break;
            case "UK":
                locLabel = "UK";
                break;
            case "NIGERIA":
                locLabel = "Nigeria";
                break;
            default:
                locLabel = "an unspecified country";
        }

        String preamble = "The user is interested in " + intentLabel.toLowerCase()
            + " in " + locLabel + ".\n"
            + "Do not ask them what they're looking to do or where — you already know. "
            + "Reference this intent and location naturally when relevant, and if the user asks "
            + "whether you know their intent, confirm it directly.\n";

        return preamble + "\n\n---\n\n" + guardrails + "\n\n---\n\n" + guide;
    }

    public String parseSuggestedAction(String response) {
        String marker = "[SUGGEST_ACTION: CREATE_PROJECT]";
        if (response.contains(marker)) {
            return "CREATE_PROJECT";
        }
        return null;
    }

    public String stripMarker(String response) {
        return response.replace("[SUGGEST_ACTION: CREATE_PROJECT]", "").trim();
    }
}
