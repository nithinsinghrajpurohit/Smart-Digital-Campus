// Use environment variable for the API base URL.
// Fallback to localhost for local development.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://smart-digital-campus-1.onrender.com";

export default API_BASE_URL;
