import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Trophy,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  Info
} from 'lucide-react';
import { StakerSnapshot } from './types';
import { getPercentileThresholds, formatNumber } from './utils';
import { mockData } from './mockData';

const API_URL = 'https://me-dashboard-server.netlify.app/api/staker-snapshot';

function StatCard({
  title,
  value,
  icon: Icon
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md p-6 text-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        <Icon className="w-5 h-5 text-pink-300" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 mb-4">
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-red-700">{message}</p>
    </div>
  );
}

function InfoMessage({ message }: { message: string }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3 mb-6">
      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-blue-700">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-indigo-950 via-purple-900 to-black">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
    </div>
  );
}

function App() {
  const [data, setData] = useState<StakerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setUsingMockData(false);

        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('API Response:', result); // Detailed logging
        
        if (!result?.result?.data?.json) {
          console.error('Invalid API response structure:', result);
          throw new Error('Invalid data structure received from API');
        }

        const stakerData = result.result.data.json;
        
        // Validate required fields
        if (!stakerData.stakers || !stakerData.totalUIStakingPower || !stakerData.totalUIStaked) {
          console.error('Missing required fields in data:', stakerData);
          throw new Error('Missing required fields in API response');
        }

        setData(stakerData);
      } catch (err) {
        console.error('Data fetching error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        console.log('Falling back to mock data');
        setData(mockData);
        setUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-900 to-black p-8 text-white">
        <div className="max-w-3xl mx-auto">
          <ErrorMessage message={error || 'Failed to load staker data'} />
        </div>
      </div>
    );
  }

  // Calculate average lock duration (in days)
  const avgDuration =
    data.stakers.reduce((acc, s) => acc + s.duration, 0) / data.stakers.length;

  // 1. Create daily delta changes for each staker
  const dailyAggregation = data.stakers.reduce((acc, staker) => {
    // Calculate the day keys for start and (if applicable) end
    const startDay = format(new Date(staker.startTs * 1000), 'yyyy-MM-dd');
    const endDay = staker.endTs
      ? format(new Date(staker.endTs * 1000), 'yyyy-MM-dd')
      : null;

    // Add stake on the start day
    acc[startDay] = acc[startDay] || { day: startDay, deltaStakingPower: 0, deltaMeStaked: 0 };
    acc[startDay].deltaStakingPower += staker.uiStakingPower;
    acc[startDay].deltaMeStaked += staker.uiAmount;

    // If an endTs exists, subtract stake on that day
    if (endDay) {
      acc[endDay] = acc[endDay] || { day: endDay, deltaStakingPower: 0, deltaMeStaked: 0 };
      acc[endDay].deltaStakingPower -= staker.uiStakingPower;
      acc[endDay].deltaMeStaked -= staker.uiAmount;
    }

    return acc;
  }, {} as Record<string, { day: string; deltaStakingPower: number; deltaMeStaked: number }>);

  // 2. Determine the full date range: from the earliest day in our data to today
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const allDays: string[] = [];

  // Determine the earliest day from dailyAggregation keys
  const daysFromData = Object.keys(dailyAggregation);
  if (daysFromData.length === 0) {
    throw new Error("No staker data available to determine date range.");
  }
  const earliestDayStr = daysFromData.sort()[0];
  let currentDate = new Date(earliestDayStr);

  // Loop from the earliest day until today's date (inclusive)
  while (format(currentDate, 'yyyy-MM-dd') <= todayStr) {
    allDays.push(format(currentDate, 'yyyy-MM-dd'));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 3. Build an array of daily data with delta values, filling missing days with zeros
  const dailyData = allDays.map(day => {
    const delta = dailyAggregation[day] || { deltaStakingPower: 0, deltaMeStaked: 0 };
    return { day, ...delta };
  });

  // 4. Compute cumulative totals up to today
  let cumulativeStakingPower = 0;
  let cumulativeMeStaked = 0;
  const cumulativeData = dailyData.map(item => {
    cumulativeStakingPower += item.deltaStakingPower;
    cumulativeMeStaked += item.deltaMeStaked;
    return {
      day: item.day,
      totalStakingPower: cumulativeStakingPower,
      totalMeStaked: cumulativeMeStaked,
    };
  });

  console.log("Cumulative chart data by day:", cumulativeData);
    

  const thresholds = getPercentileThresholds(data.stakers);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-900 to-black text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {usingMockData && (
          <InfoMessage message="Unable to connect to the live API. Showing mock data for demonstration purposes." />
        )}
        
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-600 rounded-lg p-8 shadow-lg mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            $ME Staker Dashboard
          </h1>
          <p className="max-w-2xl text-gray-100 text-sm md:text-base">
            Explore real-time stats on stakers, total staking power, and lock durations.
            Leverage these insights to make informed decisions in the $ME ecosystem.
          </p>
          <div className="mt-4 text-sm opacity-90">
            Last updated: {format(new Date(data.ts), 'PPP p')}
          </div>
        </section>

        {/* Stat Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Staking Power"
            value={formatNumber(data.totalUIStakingPower)}
            icon={TrendingUp}
          />
          <StatCard
            title="Total $ME Staked"
            value={formatNumber(data.totalUIStaked)}
            icon={Trophy}
          />
          <StatCard
            title="Total Stakers"
            value={formatNumber(data.totalLockups)}
            icon={Users}
          />
          <StatCard
            title="Avg. Lock Duration"
            value={`${formatNumber(avgDuration / 86400)} days`}
            icon={Clock}
          />
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Cumulative Total Staking Power Over Time */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Cumulative Total Staking Power Over Time</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#fff" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#fff" 
                    tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.7)', border: 'none' }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalStakingPower" 
                    stroke="#f472b6" 
                    strokeWidth={2}
                    dot={false}  // remove dots; or use dot={{ r: 2 }} for smaller ones
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative Total $ME Staked Over Time */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Cumulative Total $ME Staked Over Time</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#fff" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#fff" 
                    tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.7)', border: 'none' }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalMeStaked" 
                    stroke="#34d399" 
                    strokeWidth={2}
                    dot={false}  // remove dots; or use dot={{ r: 2 }} for smaller ones
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Thresholds Card */}
        <section className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Staking Power Thresholds</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="opacity-80">Top 1% Threshold</span>
                <span className="font-semibold">
                  {formatNumber(thresholds.top1)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-pink-500 h-2 rounded-full"
                  style={{ width: '99%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="opacity-80">Top 10% Threshold</span>
                <span className="font-semibold">
                  {formatNumber(thresholds.top10)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-pink-500 h-2 rounded-full"
                  style={{ width: '90%' }}
                ></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-8 py-4 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} Bork Research Institute. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
