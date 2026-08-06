import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { name, email, token }
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem("amn_token");
    localStorage.removeItem("amn_user");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  useEffect(() => {
    const stored = localStorage.getItem("amn_token");
    const storedUser = localStorage.getItem("amn_user");
    if (stored && storedUser) {
      try {
        // Verify token is not expired by checking the payload
        const payload = JSON.parse(atob(stored.split(".")[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token expired — clear session
          logout();
        } else {
          setUser({ ...JSON.parse(storedUser), token: stored });
          axios.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
        }
      } catch {
        // Malformed token — clear session
        logout();
      }
    }
    setLoading(false);
  }, []);

  // Global 401 interceptor — auto logout if any API call returns 401
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          logout();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const login = (token, name, email) => {
    localStorage.setItem("amn_token", token);
    localStorage.setItem("amn_user", JSON.stringify({ name, email }));
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser({ token, name, email });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
