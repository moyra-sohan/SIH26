import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchWards,
  fetchWardDetail,
  fetchStats,
  fetchRainfallTrend,
  fetchAlerts,
  predictCustom,
} from '../services/apiService';

const FloodDataContext = createContext(null);

export function FloodDataProvider({ children }) {
  const [wards, setWards] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState(null); // null = City Overview
  const [selectedWardDetail, setSelectedWardDetail] = useState(null);
  const [stats, setStats] = useState(null);
  const [rainfallTrend, setRainfallTrend] = useState([]);
  const [alertsData, setAlertsData] = useState({ alerts: [], advisories: [] });
  const [loading, setLoading] = useState(true);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Initial load
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [wardsList, cityStats, trend, alerts] = await Promise.all([
        fetchWards(),
        fetchStats(null),
        fetchRainfallTrend(null, '12m'),
        fetchAlerts(),
      ]);

      setWards(wardsList);
      setStats(cityStats);
      setRainfallTrend(trend);
      setAlertsData(alerts);
    } catch (err) {
      console.error('Error loading initial flood data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // When selected ward changes
  useEffect(() => {
    async function updateWardContext() {
      if (selectedWardId) {
        const [detail, wardStats, wardTrend] = await Promise.all([
          fetchWardDetail(selectedWardId),
          fetchStats(selectedWardId),
          fetchRainfallTrend(selectedWardId, '12m'),
        ]);
        setSelectedWardDetail(detail);
        setStats(wardStats);
        setRainfallTrend(wardTrend);
      } else {
        setSelectedWardDetail(null);
        const [cityStats, cityTrend] = await Promise.all([
          fetchStats(null),
          fetchRainfallTrend(null, '12m'),
        ]);
        setStats(cityStats);
        setRainfallTrend(cityTrend);
      }
    }
    updateWardContext();
  }, [selectedWardId]);

  // Run Custom What-If ML Simulation
  const runSimulation = async (customParams) => {
    setIsSimulating(true);
    try {
      const result = await predictCustom(customParams);
      setSimulationResult(result);
      return result;
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const selectedWard = selectedWardId
    ? wards.find((w) => w.ward_id === parseInt(selectedWardId, 10)) || selectedWardDetail?.features || null
    : null;

  const value = {
    wards,
    selectedWardId,
    setSelectedWardId,
    selectedWard,
    selectedWardDetail,
    stats,
    rainfallTrend,
    alerts: alertsData.alerts,
    advisories: alertsData.advisories,
    loading,
    simulationResult,
    setSimulationResult,
    isSimulating,
    runSimulation,
    refreshData: loadInitialData,
  };

  return <FloodDataContext.Provider value={value}>{children}</FloodDataContext.Provider>;
}

export function useFloodData() {
  const context = useContext(FloodDataContext);
  if (!context) {
    throw new Error('useFloodData must be used within a FloodDataProvider');
  }
  return context;
}
