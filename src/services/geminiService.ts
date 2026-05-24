export async function getSpendingInsights(expenses: any[]) {
  try {
    const response = await fetch("/api/gemini/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expenses }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.insights || [];
  } catch (error: any) {
    window.console.error("Gemini Insight Error:", error);
    return ["AI Insights are currently unavailable. Please check back later."];
  }
}

