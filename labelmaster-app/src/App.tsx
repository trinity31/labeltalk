import { Routes, Route } from 'react-router-dom';
import Home from './screens/Home';
import Intro from './screens/Intro';
import Onboarding from './screens/Onboarding';
import Analyze from './screens/Analyze';
import Result from './screens/Result';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/intro" element={<Intro />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/analyze" element={<Analyze />} />
      <Route path="/result" element={<Result />} />
    </Routes>
  );
}
