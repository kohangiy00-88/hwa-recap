// Server-side endpoint placeholder.
// AI video analysis and Burmese TTS will be connected here in the next setup step.
// Keep provider API keys in Netlify Environment Variables, never in index.html.

exports.handler = async () => ({
  statusCode: 501,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: "AI_SERVER_NOT_CONNECTED",
    message: "AI server မချိတ်ဆက်ရသေးပါ။ နောက်တစ်ဆင့်တွင် ချိတ်ဆက်ပေးပါမည်။"
  })
});
