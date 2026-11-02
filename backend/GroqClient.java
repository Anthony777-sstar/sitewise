import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.util.List;

public class GroqClient {

    private static final String API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String API_KEY = System.getenv("GROQ_API_KEY");
    private static final String MODEL = "openai/gpt-oss-120b";

    private final HttpClient client;

    public GroqClient() {
        this.client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    private String requireApiKey() {
        if (API_KEY == null || API_KEY.isBlank()) {
            throw new IllegalStateException(
                "GROQ_API_KEY is not set. Add it to the environment and restart the server."
            );
        }
        return API_KEY;
    }

    public String generateExecutiveSummary(int score, String riskLabel,
                                            int budget, int timeline,
                                            int safety, int resources,
                                            String projectName) throws Exception {

        String prompt = "You are a construction risk assessment expert. "
            + "Provide a concise executive summary (2-3 paragraphs) for a construction project risk assessment. "
            + "Project: \"" + projectName + "\". "
            + "Overall Risk Score: " + score + "/100 (" + riskLabel + "). "
            + "Factor breakdown — Budget risk: " + budget + "/10, "
            + "Timeline risk: " + timeline + "/10, "
            + "Safety risk: " + safety + "/10, "
            + "Resource availability risk: " + resources + "/10. "
            + "Explain what the score means, highlight the most concerning factors, "
            + "and suggest general mitigation areas. "
            + "Do NOT change or recalculate the score. "
            + "Write in a professional, calm, precise tone. "
            + "Keep it under 250 words.";

        String jsonBody = "{\"model\":\"" + MODEL + "\",\"messages\":["
            + "{\"role\":\"system\",\"content\":\"You are a construction risk assessment expert.\"},"
            + "{\"role\":\"user\",\"content\":\"" + escapeJson(prompt) + "\"}],"
            + "\"temperature\":0.7,\"max_tokens\":500}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_URL))
            .header("Authorization", "Bearer " + requireApiKey())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(60))
            .POST(BodyPublishers.ofString(jsonBody))
            .build();

        HttpResponse<String> response = client.send(request, BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Groq API error: " + response.statusCode()
                + " " + response.body());
        }

        return extractContent(response.body());
    }

    private String extractContent(String responseJson) {
        // Crude JSON extraction: find "content":"...content..."
        int contentIdx = responseJson.indexOf("\"content\":\"");
        if (contentIdx == -1) {
            // Try with escaped quotes variant
            contentIdx = responseJson.indexOf("\"content\": \"");
            if (contentIdx == -1) return "Unable to generate summary.";
        }
        int start = responseJson.indexOf('"', contentIdx + 10) + 1;
        if (start == 0) start = responseJson.indexOf('"', contentIdx + 11) + 1;
        // Find the closing quote that isn't escaped
        StringBuilder content = new StringBuilder();
        for (int i = start; i < responseJson.length(); i++) {
            char c = responseJson.charAt(i);
            if (c == '\\') {
                i++;
                if (i < responseJson.length()) {
                    char next = responseJson.charAt(i);
                    if (next == 'n') content.append('\n');
                    else if (next == 't') content.append('\t');
                    else if (next == '"') content.append('"');
                    else if (next == '\\') content.append('\\');
                    else { content.append('\\'); content.append(next); }
                }
            } else if (c == '"') {
                break;
            } else {
                content.append(c);
            }
        }
        return content.toString().trim();
    }

    public String chat(String systemPrompt, String userMessage) throws Exception {
        String jsonBody = "{\"model\":\"" + MODEL + "\",\"messages\":["
            + "{\"role\":\"system\",\"content\":\"" + escapeJson(systemPrompt) + "\"},"
            + "{\"role\":\"user\",\"content\":\"" + escapeJson(userMessage) + "\"}],"
            + "\"temperature\":0.7,\"max_tokens\":800}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_URL))
            .header("Authorization", "Bearer " + requireApiKey())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(60))
            .POST(BodyPublishers.ofString(jsonBody))
            .build();

        HttpResponse<String> response = client.send(request, BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Groq API error: " + response.statusCode()
                + " " + response.body());
        }

        return extractContent(response.body());
    }

    public String chatWithMessages(String systemPrompt, List<BuyingMessageService.Message> history, String userMessage, String pdfText) throws Exception {
        StringBuilder messagesJson = new StringBuilder();
        messagesJson.append("[");
        messagesJson.append("{\"role\":\"system\",\"content\":\"").append(escapeJson(systemPrompt)).append("\"}");

        // Append history as separate messages with correct roles
        if (history != null) {
            for (BuyingMessageService.Message msg : history) {
                messagesJson.append(",{\"role\":\"").append(escapeJson(msg.role))
                    .append("\",\"content\":\"").append(escapeJson(msg.content)).append("\"}");
            }
        }

        // Build the final user message (may include PDF text)
        StringBuilder finalUserMsg = new StringBuilder(userMessage);
        if (pdfText != null && !pdfText.isEmpty()) {
            finalUserMsg.append("\n\n[The user attached a document. Extracted text:\n")
                .append(pdfText).append("\n]");
        }
        messagesJson.append(",{\"role\":\"user\",\"content\":\"")
            .append(escapeJson(finalUserMsg.toString())).append("\"}");
        messagesJson.append("]");

        String jsonBody = "{\"model\":\"" + MODEL + "\",\"messages\":" + messagesJson.toString()
            + ",\"temperature\":0.7,\"max_tokens\":800}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_URL))
            .header("Authorization", "Bearer " + requireApiKey())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(60))
            .POST(BodyPublishers.ofString(jsonBody))
            .build();

        HttpResponse<String> response = client.send(request, BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Groq API error: " + response.statusCode()
                + " " + response.body());
        }

        return extractContent(response.body());
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
