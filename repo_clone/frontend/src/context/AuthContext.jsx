import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { name, email, token }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("amn_token");
    const storedUser = localStorage.getItem("amn_user");
    if (stored && storedUser) {
      setUser({ ...JSON.parse(storedUser), token: stored });
      axios.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
    }
    setLoading(false);
  }, []);

  const login = (token, name, email) => {
    localStorage.setItem("amn_token", token);
    localStorage.setItem("amn_user", JSON.stringify({ name, email }));
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser({ token, name, email });
  };

  const logout = () => {
    localStorage.removeItem("amn_token");
    localStorage.removeItem("amn_user");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
