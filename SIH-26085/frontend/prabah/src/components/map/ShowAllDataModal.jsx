import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';

export default function ShowAllDataModal({ isOpen, onClose }) {
  const [activeTable, setActiveTable] = useState('ward_flood_forecast');
  const [dbData, setDbData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const tablesList = [
    { key: 'ward_flood_forecast', name: 'Flood Forecast', icon: '🌊', cols: 16 },
    { key: 'ward_landscape', name: 'Landscape & Greenery', icon: '🌳', cols: 16 },
    { key: 'ward_roads_drains', name: 'Roads & Drainage', icon: '🛣️', cols: 16 },
    { key: 'ward_elevation', name: 'Elevation & Groundwater', icon: '⛰️', cols: 14 },
    { key: 'ward_temperature', name: 'Temperature Profile', icon: '🌡️', cols: 15 },
    { key: 'ward_humidity', name: 'Humidity & Heat Index', icon: '💧', cols: 16 },
    { key: 'ward_flood_events', name: 'Historical Flood Events', icon: '⚠️', cols: 18 },
    { key: 'ward_city_boundary', name: 'City Boundary & Area', icon: '🗺️', cols: 15 },
    { key: 'ward_rainfall', name: 'Rainfall Observations', icon: '🌧️', cols: 15 },
  ];

  // Fetch full database dump on mount or when opening
  useEffect(() => {
    if (!isOpen) return;
    async function loadData() {
      setLoading(true);
      try {
        const res = await api.getAllDbData();
        if (res && res.tables) {
          setDbData(res);
        }
      } catch (err) {
        console.error('Failed to load full database data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isOpen]);

  const rawRows = dbData?.tables?.[activeTable] || [];

  // Filter and sort
  const displayRows = useMemo(() => {
    let result = [...rawRows];

    // Filter by Zone
    if (zoneFilter !== 'All') {
      result = result.filter((r) => r.zone?.toLowerCase() === zoneFilter.toLowerCase());
    }

    // Filter by search
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter((r) =>
        Object.values(r).some((val) => String(val).toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortCol) {
      result.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        const strA = String(valA || '');
        const strB = String(valB || '');
        return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [rawRows, zoneFilter, searchFilter, sortCol, sortAsc]);

  const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const exportCSV = () => {
    if (displayRows.length === 0) return;
    const header = columns.join(',');
    const rows = displayRows.map((r) =>
      columns.map((c) => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTable}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (displayRows.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(displayRows, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `${activeTable}_export.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="db-modal-overlay">
      <div className="db-modal-content glass-panel">
        {/* Modal Header */}
        <div className="db-modal-header">
          <div className="db-header-title">
            <span className="db-logo-icon">🗄️</span>
            <div>
              <h2>urban_flood_nowcasting_db Database Explorer</h2>
              <p>Relational Knowledge Base across all 9 tables &amp; Kolkata municipal wards</p>
            </div>
          </div>

          <div className="db-header-actions">
            <button className="export-btn" onClick={exportCSV} title="Export current table to CSV">
              📥 CSV
            </button>
            <button className="export-btn" onClick={exportJSON} title="Export current table to JSON">
              📥 JSON
            </button>
            <button className="close-modal-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* 9 Tabs Selector */}
        <div className="db-tabs-bar">
          {tablesList.map((t) => (
            <button
              key={t.key}
              className={`db-tab-btn ${activeTable === t.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTable(t.key);
                setSortCol(null);
              }}
            >
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-name">{t.name}</span>
              <span className="tab-col-count">{t.cols} cols</span>
            </button>
          ))}
        </div>

        {/* Table Filters Bar */}
        <div className="db-table-toolbar">
          <div className="db-search-input">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder={`Search within ${activeTable}...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button className="clear-btn" onClick={() => setSearchFilter('')}>
                ✕
              </button>
            )}
          </div>

          <div className="db-zone-filter">
            <label>Filter Zone:</label>
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
              <option value="All">All Zones</option>
              <option value="Central">Central</option>
              <option value="North Central">North Central</option>
              <option value="Central East">Central East</option>
              <option value="East">East</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="South Central">South Central</option>
              <option value="South East">South East</option>
              <option value="South West">South West</option>
            </select>
          </div>

          <div className="db-table-stats">
            Showing <strong>{displayRows.length}</strong> of <strong>{rawRows.length}</strong> records ({columns.length} columns)
          </div>
        </div>

        {/* Table Container */}
        <div className="db-table-container">
          {loading ? (
            <div className="db-loading-state">
              <span className="spinner-icon">🔄</span>
              <p>Loading records from urban_flood_nowcasting_db...</p>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="db-empty-state">
              <p>No records found matching current query filters.</p>
            </div>
          ) : (
            <table className="db-data-table">
              <thead>
                <tr>
                  {columns.map((col) => {
                    const isSorted = sortCol === col;
                    return (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className={isSorted ? 'sorted-th' : ''}
                      >
                        <div className="th-content">
                          <span>{col}</span>
                          <span className="sort-arrow">
                            {isSorted ? (sortAsc ? ' ▲' : ' ▼') : ' ↕'}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={idx} className="db-data-row">
                    {columns.map((col) => {
                      const val = row[col];
                      const isRisk = col.includes('risk') || col.includes('severity');
                      let riskBadge = null;

                      if (isRisk && typeof val === 'string') {
                        const vLower = val.toLowerCase();
                        const badgeClass =
                          vLower.includes('critical') || vLower.includes('severe')
                            ? 'badge-critical'
                            : vLower.includes('high')
                            ? 'badge-high'
                            : vLower.includes('moderate')
                            ? 'badge-moderate'
                            : 'badge-low';
                        riskBadge = <span className={`table-badge ${badgeClass}`}>{val}</span>;
                      }

                      return (
                        <td key={col}>
                          {riskBadge || (
                            <span className="cell-text">
                              {val !== null && val !== undefined ? String(val) : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
