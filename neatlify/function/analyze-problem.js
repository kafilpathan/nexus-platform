exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { problem } = JSON.parse(event.body || "{}");

    if (
      typeof problem !== "string" ||
      problem.trim().length < 10 ||
      problem.length > 5000
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Problem must be between 10 and 5000 characters.",
        }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server configuration error." }),
      };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-6",
        input: `Analyze this problem and suggest practical solutions:\n${problem}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "AI analysis service failed." }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ analysis: data.output_text || "" }),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error." }),
    };
  }
};
