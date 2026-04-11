// Configuration with runtime replacement support

const config = (() => {
    // In development: Use environment variable if available
    // In production: Use placeholder that will be replaced by run.js
    const API_ENDPOINT = process.env.REACT_APP_BASE_URL || '{{BASE_URL}}';
    
    // SRT/SRTLA ports configuration
    const SRT_PLAYER_PORT = process.env.REACT_APP_SRT_PLAYER_PORT || '{{SRT_PLAYER_PORT}}';
    const SRT_SENDER_PORT = process.env.REACT_APP_SRT_SENDER_PORT || '{{SRT_SENDER_PORT}}';
    const SLS_STATS_PORT = process.env.REACT_APP_SLS_STATS_PORT || '{{SLS_STATS_PORT}}';
    // SRTLA_PORT is optional - will be empty if not configured
    const SRTLA_PORT = process.env.REACT_APP_SRTLA_PORT || '{{SRTLA_PORT}}';
    // RIST management API URL (uirist api/server.js)
    const RIST_API_URL = process.env.REACT_APP_RIST_API_URL || '{{RIST_API_URL}}';
    // Hostname shown in RIST input URLs (e.g. your-server.example.com) — falls back to RIST_API_URL host
    const RIST_SERVER_HOST = process.env.REACT_APP_RIST_SERVER_HOST || '{{RIST_SERVER_HOST}}';

    return {
        apiEndpoint: API_ENDPOINT,
        srtPlayerPort: SRT_PLAYER_PORT,
        srtSenderPort: SRT_SENDER_PORT,
        slsStatsPort: SLS_STATS_PORT,
        srtlaPort: SRTLA_PORT,
        ristApiUrl: RIST_API_URL,
        ristServerHost: RIST_SERVER_HOST,
    };
})();

export default config; 