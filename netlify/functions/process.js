
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function reply(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
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

  const key = process.env.GEMINI_API_KEY;

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
    // 1. CREATE UPLOAD SESSION
    if (action === "upload") {
      const fileName = String(body.fileName || "video.mp4");
      const mimeType = String(body.mimeType || "");
      const fileSize = Number(body.fileSize || 0);

      if (!mimeType.startsWith("video/")) {
        return reply(400, {
          error: "INVALID_FILE",
          message: "ဗီဒီယိုဖိုင်ကိုသာ ရွေးပါ။"
        });
      }

      if (
        !Number.isSafeInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > MAX_FILE_SIZE
      ) {
        return reply(400, {
          error: "INVALID_FILE_SIZE",
          message: "ဖိုင်အရွယ်အစား မမှန်ပါ။"
        });
      }

      // Browser ရဲ့ Origin ကို ယူပြီး Google ဆီ ပို့ရန်
      const origin =
        event.headers?.origin ||
        event.headers?.Origin;

      if (!origin) {
        return reply(400, {
          error: "ORIGIN_MISSING",
          message: "Browser Origin မရရှိပါ။ Website ကို ပြန်ဖွင့်ပါ။"
        });
      }

      const startResponse = await fetch(
        `${UPLOAD_BASE}/files`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Origin": origin,
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
          message: errorText.slice(0, 1200)
        });
      }

      const uploadUrl =
        startResponse.headers.get("x-goog-upload-url");

      if (!uploadUrl) {
        return reply(500, {
          error: "UPLOAD_URL_MISSING",
          message: "Google Upload URL မရရှိပါ။"
        });
      }

      return reply(200, {
        success: true,
        uploadUrl
      });
    }

    // 2. GENERATE RECAP
    if (action === "analyze") {
      const fileUri = String(body.fileUri || "");
      const mimeType = String(body.mimeType || "");

      if (
        !fileUri.startsWith(
          "https://generativelanguage.googleapis.com/"
        ) ||
        !mimeType.startsWith("video/")
      ) {
        return reply(400, {
          error: "INVALID_VIDEO",
          message: "Video အချက်အလက် မမှန်ပါ။"
        });
      }

      const prompt = `
သင်သည် ဗီဒီယိုကို ကြည့်ရှုပြီး မြန်မာဘာသာဖြင့်
အသေးစိတ် ဇာတ်လမ်းပြန်လည်ပြောပြပေးသော AI ဖြစ်သည်။

ဗီဒီယိုထဲတွင် အမှန်တကယ်မြင်တွေ့ရသော ဇာတ်လမ်းကို
အစမှ အဆုံးအထိ အစီအစဉ်တကျ ပြန်လည်ရေးသားပါ။

လိုက်နာရန် -

၁။ ဇာတ်လမ်းဖြစ်စဉ်များကို ဗီဒီယိုအစီအစဉ်အတိုင်းရေးပါ။
၂။ အရေးကြီးသော အဖြစ်အပျက်များကို မကျော်ပါနှင့်။
၃။ ဇာတ်ကောင်များ၏ လုပ်ဆောင်ချက်၊ တုံ့ပြန်မှု၊
မြင်တွေ့ရသော စိတ်ခံစားမှုများကို ဖော်ပြပါ။
၄။ နေရာ၊ ပစ္စည်းနှင့် ဇာတ်ကောင်ဆက်နွယ်မှုများကို
ဗီဒီယိုက ထောက်ခံသည့်အတိုင်းရေးပါ။
၅။ မပါဝင်သော ဇာတ်ကောင်၊ ဖြစ်ရပ်၊ စကားပြောခန်း၊
အကြောင်းရင်းများကို မတီထွင်ပါနှင့်။
၆။ မကြားရသော စကားများကို မဖြည့်ပါနှင့်။
၇။ အကျဉ်းချုပ်တိုတို မလုပ်ပါနှင့်။
၈။ သဘာဝကျသော မြန်မာဇာတ်လမ်းပြောဟန်ဖြင့်ရေးပါ။
၉။ ထပ်ခါထပ်ခါ မရေးပါနှင့်။
၁၀။ ဗီဒီယိုအဆုံးအထိ ဖော်ပြပါ။

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
            contents: [{
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
            }],
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
            "AI က Recap မထုတ်ပေးနိုင်ပါ။"
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
