const API_BASE = "";

async function assessRisk({ projectName, budget, timeline, safety, resources }) {
    let response;
    try {
        response = await fetch(`${API_BASE}/api/assess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectName, budget, timeline, safety, resources })
        });
    } catch (err) {
        throw new Error(
            'Cannot reach the Java backend. Make sure to start it first:\n'
            + '  cd backend && javac *.java && java Main\n\n'
            + '(The server must run on http://localhost:8080)'
        );
    }

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `Server error: ${response.status}`);
    }

    return await response.json();
}
