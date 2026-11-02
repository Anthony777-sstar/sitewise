import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.File;
import java.io.FileInputStream;
import java.net.InetSocketAddress;
import java.net.URI;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;

public class Main {

    private static GroqClient groq;
    private static BuyingAssistantPromptService promptService;
    private static BuyingMessageService messageService;

    public static void main(String[] args) throws Exception {
        groq = new GroqClient();
        promptService = new BuyingAssistantPromptService();
        messageService = new BuyingMessageService(groq, promptService);
        String portStr = args.length > 0 ? args[0] : System.getenv("PORT");
        int port = portStr != null ? Integer.parseInt(portStr) : 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/assess", new AssessHandler());
        server.createContext("/api/buying-assistant/chat", new BuyingChatHandler());
        server.createContext("/healthz", exchange -> {
            byte[] body = "{\"status\":\"ok\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        server.createContext("/", new StaticHandler());
        server.setExecutor(Executors.newFixedThreadPool(8));
        String msg = "Sitewise running on http://0.0.0.0:" + port;
        System.out.println(msg);
        server.start();
    }

    static class AssessHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
                exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
                exchange.getResponseHeaders().add("Content-Type", "application/json");

                if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(204, -1);
                    return;
                }

                if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                    sendJson(exchange, 405, "{\"error\":\"Method not allowed\"}");
                    return;
                }

                InputStream is = exchange.getRequestBody();
                byte[] bodyBytes = is.readAllBytes();
                String body = new String(bodyBytes, StandardCharsets.UTF_8);

                String projectName = extractString(body, "projectName");
                int budget = extractInt(body, "budget");
                int timeline = extractInt(body, "timeline");
                int safety = extractInt(body, "safety");
                int resources = extractInt(body, "resources");

                RiskScorer scorer = new RiskScorer(budget, timeline, safety, resources);
                int score = scorer.calculateScore();
                String riskLabel = scorer.getRiskLabel(score);

                GroqClient groq = new GroqClient();
                String summary = groq.generateExecutiveSummary(
                    score, riskLabel, budget, timeline, safety, resources, projectName
                );

                String json = "{\"projectName\":\"" + escapeJson(projectName)
                    + "\",\"budget\":" + budget
                    + ",\"timeline\":" + timeline
                    + ",\"safety\":" + safety
                    + ",\"resources\":" + resources
                    + ",\"score\":" + score
                    + ",\"riskLabel\":\"" + riskLabel + "\""
                    + ",\"executiveSummary\":\"" + escapeJson(summary) + "\"}";

                sendJson(exchange, 200, json);

            } catch (Exception e) {
                e.printStackTrace();
                try {
                    String err = "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
                    sendJson(exchange, 500, err);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }

        private void sendJson(HttpExchange exchange, int code, String json) throws Exception {
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(code, bytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(bytes);
            os.close();
        }

        private String extractString(String json, String key) {
            String search = "\"" + key + "\":\"";
            int start = json.indexOf(search);
            if (start == -1) return "";
            start += search.length();
            StringBuilder value = new StringBuilder();
            for (int i = start; i < json.length(); i++) {
                char c = json.charAt(i);
                if (c == '\\') {
                    i++;
                    if (i < json.length()) value.append(json.charAt(i));
                } else if (c == '"') {
                    break;
                } else {
                    value.append(c);
                }
            }
            return value.toString();
        }

        private int extractInt(String json, String key) {
            String search = "\"" + key + "\":";
            int start = json.indexOf(search);
            if (start == -1) return 1;
            start += search.length();
            StringBuilder value = new StringBuilder();
            for (int i = start; i < json.length(); i++) {
                char c = json.charAt(i);
                if (c >= '0' && c <= '9' || c == '-') {
                    value.append(c);
                } else {
                    break;
                }
            }
            if (value.length() == 0) return 1;
            return Integer.parseInt(value.toString());
        }

        private String escapeJson(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
        }
    }

    static class BuyingChatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "POST, OPTIONS");
                exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
                exchange.getResponseHeaders().add("Content-Type", "application/json");

                if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                    exchange.sendResponseHeaders(204, -1);
                    return;
                }

                if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                    sendJson(exchange, 405, "{\"error\":\"Method not allowed\"}");
                    return;
                }

                InputStream is = exchange.getRequestBody();
                byte[] bodyBytes = is.readAllBytes();
                String body = new String(bodyBytes, StandardCharsets.UTF_8);

                String intentType = extractString(body, "intentType");
                String location = extractStringOrNull(body, "location");
                String userMessage = extractString(body, "userMessage");
                String pdfText = extractStringOrNull(body, "pdfText");

                if (intentType.isEmpty() || userMessage.isEmpty()) {
                    sendJson(exchange, 400, "{\"error\":\"Missing intentType or userMessage\"}");
                    return;
                }

                List<BuyingMessageService.Message> history = parseHistory(body);

                BuyingMessageService.ChatResult result = messageService.processMessage(
                    intentType, location, history, userMessage, pdfText
                );

                String json = "{\"content\":" + jsonValue(result.content)
                    + ",\"suggestedAction\":" + (result.suggestedAction != null
                        ? "\"" + escapeJson(result.suggestedAction) + "\""
                        : "null")
                    + "}";

                sendJson(exchange, 200, json);

            } catch (Exception e) {
                e.printStackTrace();
                try {
                    String err = "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
                    sendJson(exchange, 500, err);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }

        private void sendJson(HttpExchange exchange, int code, String json) throws Exception {
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(code, bytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(bytes);
            os.close();
        }

        private String extractString(String json, String key) {
            String search = "\"" + key + "\":\"";
            int start = json.indexOf(search);
            if (start == -1) return "";
            start += search.length();
            StringBuilder value = new StringBuilder();
            for (int i = start; i < json.length(); i++) {
                char c = json.charAt(i);
                if (c == '\\') {
                    i++;
                    if (i < json.length()) value.append(json.charAt(i));
                } else if (c == '"') {
                    break;
                } else {
                    value.append(c);
                }
            }
            return value.toString();
        }

        private String extractStringOrNull(String json, String key) {
            String search = "\"" + key + "\":";
            int start = json.indexOf(search);
            if (start == -1) return null;
            start += search.length();
            if (start < json.length() && json.charAt(start) == 'n') {
                return null;
            }
            if (start < json.length() && json.charAt(start) == '"') start++;
            StringBuilder value = new StringBuilder();
            for (int i = start; i < json.length(); i++) {
                char c = json.charAt(i);
                if (c == '\\') {
                    i++;
                    if (i < json.length()) value.append(json.charAt(i));
                } else if (c == '"') {
                    break;
                } else {
                    value.append(c);
                }
            }
            return value.toString();
        }

        private List<BuyingMessageService.Message> parseHistory(String json) {
            List<BuyingMessageService.Message> history = new ArrayList<>();
            int historyStart = json.indexOf("\"history\":[");
            if (historyStart == -1) return history;
            historyStart += 10;
            int depth = 0;
            int arrayStart = historyStart;
            for (int i = historyStart; i < json.length(); i++) {
                if (json.charAt(i) == '[') depth++;
                else if (json.charAt(i) == ']') {
                    depth--;
                    if (depth == -1) {
                        String arrayContent = json.substring(arrayStart, i);
                        parseHistoryItems(arrayContent, history);
                        break;
                    }
                }
            }
            return history;
        }

        private void parseHistoryItems(String arrayContent, List<BuyingMessageService.Message> history) {
            int i = 0;
            while (i < arrayContent.length()) {
                while (i < arrayContent.length() && arrayContent.charAt(i) != '{') i++;
                if (i >= arrayContent.length()) break;
                int braceDepth = 0;
                int objStart = i;
                for (; i < arrayContent.length(); i++) {
                    if (arrayContent.charAt(i) == '{') braceDepth++;
                    else if (arrayContent.charAt(i) == '}') {
                        braceDepth--;
                        if (braceDepth == 0) {
                            String obj = arrayContent.substring(objStart, i + 1);
                            String role = extractString(obj, "role");
                            String content = extractString(obj, "content");
                            if (!role.isEmpty()) {
                                history.add(new BuyingMessageService.Message(role, content));
                            }
                            break;
                        }
                    }
                }
                i++;
            }
        }

        private String escapeJson(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
        }

        private String jsonValue(String s) {
            if (s == null) return "null";
            return "\"" + escapeJson(s) + "\"";
        }
    }

    static class StaticHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) {
            try {
                String path = exchange.getRequestURI().getPath();

                // Route to the correct root directory
                String rootDir;
                String servePath;
                if (path.startsWith("/websitecdnshaders")) {
                    rootDir = "websitecdnshaders";
                    servePath = path.substring("/websitecdnshaders".length());
                    if (servePath.isEmpty() || servePath.equals("/")) servePath = "/index.html";
                } else {
                    rootDir = "frontend";
                    servePath = path;
                    if (servePath.equals("/")) servePath = "/index.html";
                }

                File file = new File(rootDir + servePath).getCanonicalFile();
                File root = new File(rootDir).getCanonicalFile();
                if (!file.getPath().startsWith(root.getPath())) {
                    send404(exchange);
                    return;
                }

                if (!file.isFile()) {
                    file = new File(rootDir + "/index.html");
                }

                if (!file.isFile()) {
                    send404(exchange);
                    return;
                }

                String contentType = probeContentType(file.getName());
                exchange.getResponseHeaders().set("Content-Type", contentType);
                exchange.sendResponseHeaders(200, file.length());

                try (FileInputStream fis = new FileInputStream(file);
                     OutputStream os = exchange.getResponseBody()) {
                    fis.transferTo(os);
                }
            } catch (Exception e) {
                try {
                    send404(exchange);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }

        private void send404(HttpExchange exchange) throws Exception {
            String msg = "404 Not Found";
            exchange.sendResponseHeaders(404, msg.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(msg.getBytes());
            }
        }

        private String probeContentType(String name) {
            if (name.endsWith(".html")) return "text/html; charset=utf-8";
            if (name.endsWith(".css")) return "text/css; charset=utf-8";
            if (name.endsWith(".js")) return "application/javascript; charset=utf-8";
            if (name.endsWith(".json")) return "application/json";
            if (name.endsWith(".png")) return "image/png";
            if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
            if (name.endsWith(".svg")) return "image/svg+xml";
            if (name.endsWith(".ico")) return "image/x-icon";
            if (name.endsWith(".webp")) return "image/webp";
            if (name.endsWith(".woff2")) return "font/woff2";
            if (name.endsWith(".woff")) return "font/woff";
            return "application/octet-stream";
        }
    }
}
