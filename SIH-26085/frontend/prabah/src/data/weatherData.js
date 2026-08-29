export const currentWeather = {
  temperature: 28,
  condition: 'Light Rain',
  feelsLike: 31,
  humidity: 82,
  wind: '14 km/h NE',
  pressure: '1006 hPa',
  visibility: '6 km',
};

export const forecastData = {
  today: [
    { time: 'Now', temp: 28, condition: 'Light Rain', humidity: 82, icon: 'cloud-rain' },
    { time: '3 PM', temp: 29, condition: 'Moderate Rain', humidity: 70, icon: 'cloud-rain' },
    { time: '6 PM', temp: 27, condition: 'Moderate Rain', humidity: 78, icon: 'cloud-rain' },
    { time: '9 PM', temp: 26, condition: 'Light Rain', humidity: 80, icon: 'cloud-drizzle' },
    { time: '12 AM', temp: 25, condition: 'Cloudy', humidity: 65, icon: 'cloud' },
  ],
  tomorrow: [
    { time: '6 AM', temp: 24, condition: 'Cloudy', humidity: 72, icon: 'cloud' },
    { time: '9 AM', temp: 26, condition: 'Light Rain', humidity: 78, icon: 'cloud-drizzle' },
    { time: '12 PM', temp: 29, condition: 'Heavy Rain', humidity: 85, icon: 'cloud-rain' },
    { time: '3 PM', temp: 28, condition: 'Moderate Rain', humidity: 80, icon: 'cloud-rain' },
    { time: '6 PM', temp: 26, condition: 'Light Rain', humidity: 75, icon: 'cloud-drizzle' },
  ],
  '3days': [
    { time: 'Day 1', temp: 27, condition: 'Rainy', humidity: 80, icon: 'cloud-rain' },
    { time: 'Day 2', temp: 30, condition: 'Partly Cloudy', humidity: 65, icon: 'cloud-sun' },
    { time: 'Day 3', temp: 31, condition: 'Sunny', humidity: 55, icon: 'sun' },
  ],
};

export const statsData = [
  {
    id: 1,
    label: 'Rainfall (24h)',
    value: '82',
    unit: 'mm',
    status: '↑ 12% from yesterday',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    iconName: 'CloudRain',
  },
  {
    id: 2,
    label: 'Flood Risk Index',
    value: '0.78',
    unit: '',
    status: 'High',
    statusExtra: 'Rising',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
    iconName: 'AlertTriangle',
  },
  {
    id: 3,
    label: 'Water Level (Hooghly)',
    value: '4.2',
    unit: 'm',
    status: 'Above Normal',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    iconName: 'Waves',
  },
  {
    id: 4,
    label: 'Drainage Status',
    value: 'Normal',
    unit: '',
    status: 'Operational',
    color: '#16A34A',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    iconName: 'Settings',
  },
  {
    id: 5,
    label: 'Affected Roads',
    value: '12',
    unit: '',
    status: 'Moderate Impact',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    iconName: 'MapPin',
  },
];

export const landEnvironmentData = [
  { label: 'Land Type', value: 'Urban', iconName: 'Building2' },
  { label: 'Elevation', value: '9 m above sea level', iconName: 'Mountain' },
  { label: 'Soil Type', value: 'Alluvial', iconName: 'Layers' },
  { label: 'Green Cover', value: '18%', iconName: 'TreePine' },
  { label: 'Impervious Surface', value: '62%', iconName: 'Square' },
];
