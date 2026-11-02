// netlify/functions/process.js

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function reply(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(data)
  };
}

function getKey() {
  return process.env.GEMINI_API_KEY;
}

function getBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, {
      error: "METHOD_NOT_ALLOWED",
      message: "POST ဖြင့်သာ အသုံးပြုနိုင်ပါတယ်။"
    });
  }

  const key = getKey();

  if (!key) {
    return reply(500, {
      error: "API_KEY_MISSING",
      message: "Netlify မှာ GEMINI_API_KEY မတွေ့ပါ။"
    });
  }

  const body = getBody(event);
  const action =
    event.queryStringParameters?.action || body.action;

  try {

    // =====================================
    // 1. CREATE VIDEO UPLOAD SESSION
    // =====================================

    if (action === "upload") {
      const fileName = String(body.fileName || "video.mp4");
      const mimeType = String(body.mimeType || "");
      const fileSize = Number(body.fileSize || 0);

      if (!mimeType.startsWith("video/")) {
        return reply(400, {
          error: "INVALID_FILE",
          message: "ဗီဒီယိုဖိုင်ကိုသာ ရွေးပေးပါ။"
        });
      }

      if (!fileSize || fileSize > MAX_FILE_SIZE) {
        return reply(400, {
          error: "INVALID_FILE_SIZE",
          message: "ဖိုင်အရွယ်အစား မမှန်ပါ။"
        });
      }

      const startResponse = await fetch(
        `${UPLOAD_BASE}/files`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length":
              String(fileSize),
            "X-Goog-Upload-Header-Content-Type": mimeType,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            file: {
              display_name: fileName.slice(0, 100)
            }
          })
        }
      );

      if (!startResponse.ok) {
        const errorText = await startResponse.text();

        return reply(startResponse.status, {
          error: "UPLOAD_SESSION_FAILED",
          message: errorText.slice(0, 1000)
        });
      }

      const uploadUrl =
        startResponse.headers.get("x-goog-upload-url");

      if (!uploadUrl) {
        return reply(500, {
          error: "UPLOAD_URL_MISSING",
          message: "Upload URL မရရှိပါ။"
        });
      }

      return reply(200, {
        success: true,
        uploadUrl
      });
    }

    // =====================================
    // 2. ANALYZE VIDEO AND CREATE RECAP
    // =====================================

    if (action === "analyze") {
      const fileUri = String(body.fileUri || "");
      const mimeType = String(body.mimeType || "");

      if (
        !fileUri.startsWith("https://") ||
        !mimeType.startsWith("video/")
      ) {
        return reply(400, {
          error: "INVALID_VIDEO",
          message: "ဗီဒီယိုအချက်အလက် မပြည့်စုံပါ။"
        });
      }

      const prompt = `
သင်သည် ဗီဒီယိုကို ကြည့်ရှုပြီး မြန်မာဘာသာဖြင့်
အသေးစိတ် ဇာတ်လမ်းပြန်လည်ပြောပြပေးသော AI ဖြစ်သည်။

တာဝန်မှာ ဤဗီဒီယိုထဲတွင် အမှန်တကယ်မြင်တွေ့ရသော
ဇာတ်လမ်းကို အစမှ အဆုံးအထိ အစီအစဉ်တကျ
မြန်မာဘာသာဖြင့် ပြန်လည်ရေးသားရန်ဖြစ်သည်။

လိုက်နာရန် -

၁။ ဇာတ်လမ်းဖြစ်စဉ်များကို ဗီဒီယိုထဲရှိ အစီအစဉ်အတိုင်းရေးပါ။
၂။ အရေးကြီးသော အဖြစ်အပျက်များကို မကျော်ပါနှင့်။
၃။ ဇာတ်ကောင်များ၏ လုပ်ဆောင်ချက်၊ တုံ့ပြန်မှုနှင့်
မြင်တွေ့ရသော စိတ်ခံစားမှုများကို ဖော်ပြပါ။
၄။ နေရာ၊ ပစ္စည်းနှင့် ဇာတ်ကောင်အချင်းချင်း
ဆက်နွယ်မှုများကို ဗီဒီယိုက ထောက်ခံသည့်အတိုင်းရေးပါ။
၅။ ဗီဒီယိုထဲတွင် မပါသော ဇာတ်ကောင်၊ ဖြစ်ရပ်၊
စကားပြောခန်းနှင့် အကြောင်းရင်းများကို မတီထွင်ပါနှင့်။
၆။ မကြားရသော စကားများကို ကိုယ်တိုင်ဖြည့်မရေးပါနှင့်။
၇။ အကျဉ်းချုပ်တိုတို မလုပ်ပါနှင့်။
၈။ သဘာဝကျသော မြန်မာဇာတ်လမ်းပြောဟန်ဖြင့် ရေးပါ။
၉။ အဖြစ်အပျက်များကို အလွန်အကျွံ ထပ်ခါထပ်ခါ
မရေးပါနှင့်။
၁၀။ ဗီဒီယိုအဆုံးအထိ ရောက်အောင် ဆက်လက်ဖော်ပြပါ။

အရေးကြီးသည် -
ဗီဒီယိုထဲတွင် မမြင်ရသော အချက်အလက်ကို
ခန့်မှန်းပြီး အမှန်တကယ်ဖြစ်ခဲ့သကဲ့သို့ မရေးပါနှင့်။

ယခု ဗီဒီယို၏ ဇာတ်လမ်းကို အသေးစိတ်
မြန်မာဘာသာဖြင့် ပြန်လည်ရေးသားပါ။
`;

      const generateResponse = await fetch(
        `${API_BASE}/models/${encodeURIComponent(MODEL)}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    file_data: {
                      mime_type: mimeType,
                      file_uri: fileUri
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 16000
            }
          })
        }
      );

      const result = await generateResponse.json();

      if (!generateResponse.ok) {
        return reply(generateResponse.status, {
          error: "AI_GENERATION_FAILED",
          message:
            result.error?.message ||
            "AI က စာထုတ်မပေးနိုင်ပါ။"
        });
      }

      const recap = (
        result.candidates?.[0]?.content?.parts || []
      )
        .map(part => part.text || "")
        .join("\n")
        .trim();

      if (!recap) {
        return reply(500, {
          error: "EMPTY_RECAP",
          message: "AI ထံမှ စာသားမရရှိပါ။"
        });
      }

      return reply(200, {
        success: true,
        recap
      });
    }

    return reply(400, {
      error: "UNKNOWN_ACTION",
      message: "လုပ်ဆောင်ချက် မသိရှိပါ။"
    });

  } catch (error) {
    return reply(500, {
      error: "SERVER_ERROR",
      message: error.message || "Server အမှားဖြစ်နေပါတယ်။"
    });
  }
};
