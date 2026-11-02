import java.util.UUID;

public class BuyingConversationService {

    // CRUD is handled by frontend via Supabase directly.
    // This service exists for any server-side logic if needed in the future.
    // Currently, the Java backend only does AI-related processing.

    public static boolean isValidIntent(String intentType) {
        return "BUY_HOUSE".equals(intentType)
            || "BUILD_HOUSE".equals(intentType)
            || "BUY_LAND".equals(intentType);
    }
}
