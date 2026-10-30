exports.handler = async (event) => {
  const WORKER_URL =
    "https://nexus-kaf-ai.kumarchotu36553.workers.dev/";

  try {
    const response = await fetch(WORKER_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: data
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "NEXUS backend connection failed"
      })
    };
  }
};
