// Configuração central da URL do backend
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://app-dupa.onrender.com";
export const API_URL = `${BACKEND_URL}/api`;
export default BACKEND_URL;
