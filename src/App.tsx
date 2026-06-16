import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Console from "@/pages/Console";
import Draw from "@/pages/Draw";
import Results from "@/pages/Results";
import Settings from "@/pages/Settings";
import Archive from "@/pages/Archive";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/console" element={<Console />} />
        <Route path="/draw" element={<Draw />} />
        <Route path="/results" element={<Results />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
