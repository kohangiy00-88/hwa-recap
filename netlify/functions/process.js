
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "METHOD_NOT_ALLOWED" })
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "API_KEY_MISSING",
        message: "Netlify မှာ GEMINI_API_KEY မတွေ့ပါ။"
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    if (!body.action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "ACTION_REQUIRED" })
      };
    }

    if (body.action === "analyze") {
      if (!body.fileUri || !body.mimeType) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "VIDEO_REQUIRED",
            message: "Video file URI နဲ့ MIME type လိုအပ်ပါတယ်။"
          })
        };
      }

      const prompt = `
သင်သည် မြန်မာဘာသာ Movie Recap ဇာတ်လမ်းပြောသူဖြစ်သည်။

ပေးထားသော Video ကို စစ်ဆေးပြီး အစမှအဆုံး
ဖြစ်စဉ်အစီအစဉ်အတိုင်း မြန်မာ Recap ရေးပါ။

စည်းမျဉ်းများ -
၁။ Video ထဲမှာ တကယ်ပါဝင်သော အဖြစ်အပျက်ကိုသာ ရေးပါ။
၂။ ဇာတ်ကောင်၊ နေရာ၊ စကားနှင့် အကြောင်းအရာ မတီထွင်ပါနှင့်။
၃။ အရေးကြီးသော ဖြစ်စဉ်များကို မကျော်ပါနှင့်။
၄။ ဇာတ်ကောင်တို့၏ လုပ်ရပ်နှင့် တုံ့ပြန်မှုကို
Video က ထောက်ခံသည့်အတိုင်း ရေးပါ။
၅။ သဘာဝကျသော မြန်မာစကားပြောပုံစံဖြင့် ရေးပါ။
၆။ မသေချာသော အချက်ကို ခန့်မှန်းမရေးပါနှင့်။
၇။ အကျဉ်းချုပ်မဟုတ်ဘဲ အသေးစိတ် narration ရေးပါ။
`;

      const response = await fetch(
        `${API_BASE}/models/gemini-2.5-flash:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  file_data: {
                    mime_type: body.mimeType,
                    file_uri: body.fileUri
                  }
                },
                { text: prompt }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 16000
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({
            error: "GEMINI_ERROR",
            message: result.error?.message || "Gemini API Error"
          })
        };
      }

      const recap = (result.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || "")
        .join("")
        .trim();

      if (!recap) {
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({
            error: "EMPTY_RESPONSE",
            message: "AI က Recap စာသားမပေးပါ။"
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, recap })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "UNKNOWN_ACTION" })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "SERVER_ERROR",
        message: error.message || "Unknown error"
      })
    };
  }
};
