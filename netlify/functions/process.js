exports.handler = async () => ({
  statusCode: 501,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    error: "AI_SERVER_NOT_CONNECTED",
    message: "AI Server မချိတ်ဆက်ရသေးပါ။"
  })
});
