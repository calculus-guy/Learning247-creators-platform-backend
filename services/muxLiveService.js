// Ensure you are using the correct import for your Mux version
const Mux = require('@mux/mux-node'); 

// Check for missing keys immediately to avoid runtime crashes
if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.error("FATAL: MUX_TOKEN_ID or MUX_TOKEN_SECRET is missing from .env");
}

// Instantiate Mux Client
const muxClient = new Mux(
  process.env.MUX_TOKEN_ID,
  process.env.MUX_TOKEN_SECRET
);

const LiveStreams = muxClient.video.liveStreams;
const Assets = muxClient.video.assets;

async function createLiveStream({ title, passthrough }) {
  try {
    const live = await LiveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public']
      },
      latency_mode: 'low',
      reconnect_window: 60,
      passthrough,
    });

    return {
      mux_stream_id: live.id,
      mux_stream_key: live.stream_key,
      mux_rtmp_url: 'rtmp://global-live.mux.com:5222/app',
      mux_playback_id: live.playback_ids?.[0]?.id || null
    };
  } catch (err) {
    console.error('Mux API Error in createLiveStream:', err);
    // Attach a flag so the controller knows this is a 3rd party API error
    err.name = 'MuxError'; 
    throw err;
  }
}

function generatePlaybackUrl(playbackId) {
  if (!playbackId) return null;
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

module.exports = {
  createLiveStream,
  generatePlaybackUrl,
  getAsset: async (assetId) => {
    try {
      return await Assets.get(assetId);
    } catch (err) {
      console.error('getAsset error', err);
      return null;
    }
  }
};