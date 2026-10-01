import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { PassengerPage } from './pages/PassengerPage';
import { ControlPage } from './pages/ControlPage';
import { StationDashboard } from './pages/StationDashboard';
import { TrainDetailPage } from './pages/TrainDetailPage';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 font-sans">
        <Header />
        
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/passenger" replace />} />
            <Route path="/passenger" element={<PassengerPage />} />
            <Route path="/control" element={<ControlPage />} />
            <Route path="/station" element={<StationDashboard />} />
            <Route path="/train/:trainId" element={<TrainDetailPage />} />
            <Route path="/admin" element={<AdminAnalyticsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
