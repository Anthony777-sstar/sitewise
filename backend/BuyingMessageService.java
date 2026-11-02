import java.util.List;
import java.util.ArrayList;

public class BuyingMessageService {

    private final GroqClient groqClient;
    private final BuyingAssistantPromptService promptService;

    public BuyingMessageService(GroqClient groqClient, BuyingAssistantPromptService promptService) {
        this.groqClient = groqClient;
        this.promptService = promptService;
    }

    public ChatResult processMessage(String intentType, String location, List<Message> history, String userMessage, String pdfText) throws Exception {
        String systemPrompt = promptService.buildSystemPrompt(intentType, location != null ? location : "NIGERIA");

        String reminder = "--- REMINDER BEFORE YOU RESPOND ---\n"
            + "Before writing your response, confirm:\n"
            + "- You will NOT say you can \"pull up,\" \"find,\" \"search for,\" or \"show\" listings — you have no listing access.\n"
            + "- You will NOT say you can \"suggest,\" \"connect you with,\" or \"recommend\" specific lenders, agents, inspectors, or suppliers — you have no verified directory of these.\n"
            + "- You will ONLY include a link if it appears character-for-character in the USEFUL LINKS section of your guide content below. You will NOT state any other URL, government site, or organization website from memory or by guessing a plausible domain name. If no relevant link exists in your provided list, say so plainly instead of providing one.\n"
            + "- Structure your response as: one opening sentence, a short plain bullet list if needed (max 5 bullets, no sub-bullets, no bold inside bullets), one closing sentence. No tables, no headers, no emoji, no \"---\" dividers. Keep it under 120 words unless the user explicitly asked for something comprehensive.\n"
            + "- You will NOT use emoji or an enthusiastic sales tone (\"Let's get you moving!\", exclamation points as a default style).\n"
            + "- If this response involves financing, legal steps, or contracts, you WILL end with a reminder to consult a licensed professional.\n"
            + "--- END REMINDER ---\n\n";
        String userMessageWithReminder = reminder + userMessage;

        String rawResponse = groqClient.chatWithMessages(systemPrompt, history, userMessageWithReminder, pdfText);

        String suggestedAction = promptService.parseSuggestedAction(rawResponse);
        String cleanResponse = promptService.stripMarker(rawResponse);

        ChatResult result = new ChatResult();
        result.content = cleanResponse;
        result.suggestedAction = suggestedAction;
        return result;
    }

    public static class Message {
        public String role;
        public String content;

        public Message() {}

        public Message(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }

    public static class ChatResult {
        public String content;
        public String suggestedAction;

        public ChatResult() {}

        public ChatResult(String content, String suggestedAction) {
            this.content = content;
            this.suggestedAction = suggestedAction;
        }
    }
}
