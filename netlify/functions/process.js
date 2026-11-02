exports.handler = async () => ({
  statusCode: 501,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    error: "AI_PROVIDER_NOT_CONFIGURED",
    message: "HWA Recap AI ဝန်ဆောင်မှု မချိတ်ဆက်ရသေးပါ။"
  })
});
