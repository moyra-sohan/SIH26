import { Phone, AlertTriangle, MapPin, Clock, Heart } from 'lucide-react';
import '../styles/emergency.css';

export default function EmergencySupport() {
  const emergencyNumbers = [
    { 
      id: 1,
      label: 'Emergency', 
      number: '100', 
      description: 'Police & General Emergency',
      icon: '🚨',
      color: 'red'
    },
    { 
      id: 2,
      label: 'Disaster Management', 
      number: '1098', 
      description: 'Natural Disasters & Rescue',
      icon: '🆘',
      color: 'orange'
    },
    { 
      id: 3,
      label: 'Fire Service', 
      number: '101', 
      description: 'Fire & Firefighting Services',
      icon: '🔥',
      color: 'red'
    },
    { 
      id: 4,
      label: 'Kolkata Police', 
      number: '2245-3333', 
      description: 'Non-Emergency Police Helpline',
      icon: '🚓',
      color: 'blue'
    },
    { 
      id: 5,
      label: 'Municipal Corporation', 
      number: '1800-203-6060', 
      description: 'Municipal Services & Complaints',
      icon: '🏗️',
      color: 'purple'
    },
    { 
      id: 6,
      label: 'Ambulance', 
      number: '102', 
      description: 'Medical Emergency & Ambulance',
      icon: '🚑',
      color: 'red'
    },
  ];

  const safetyTips = [
    {
      icon: <AlertTriangle size={24} />,
      title: 'Stay Alert',
      description: 'Monitor weather alerts and flood warnings regularly'
    },
    {
      icon: <MapPin size={24} />,
      title: 'Know Evacuation Routes',
      description: 'Identify safe zones and evacuation paths in your area'
    },
    {
      icon: <Clock size={24} />,
      title: 'Prepare in Advance',
      description: 'Keep emergency kits ready before flood season'
    },
    {
      icon: <Heart size={24} />,
      title: 'Help Others',
      description: 'Assist neighbors and vulnerable community members'
    },
  ];

  return (
    <div className="emergency-support-page">
      {/* Header */}
      <div className="emergency-header-section">
        <div className="emergency-header-content">
          <div className="emergency-icon-large">🚨</div>
          <h1>Emergency Support & Hotlines</h1>
          <p>24/7 Emergency Services for Kolkata Flood Disasters</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="emergency-container">
        {/* Emergency Numbers Section */}
        <section className="emergency-section">
          <h2>
            <Phone size={24} />
            Emergency Hotlines
          </h2>
          <p className="section-subtitle">Critical contact numbers available 24/7</p>
          
          <div className="emergency-grid">
            {emergencyNumbers.map((item) => (
              <div key={item.id} className={`emergency-card emergency-${item.color}`}>
                <div className="card-icon">{item.icon}</div>
                <div className="card-content">
                  <h3>{item.label}</h3>
                  <p className="card-description">{item.description}</p>
                  <div className="card-number">
                    <a href={`tel:${item.number.replace('-', '')}`}>
                      {item.number}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alert Banner */}
        <section className="alert-banner">
          <AlertTriangle size={28} />
          <div>
            <strong>In case of immediate danger:</strong>
            <p>Call <span>100</span> or <span>102</span> immediately. Do not delay!</p>
          </div>
        </section>

        {/* Safety Tips Section */}
        <section className="emergency-section">
          <h2>
            <Heart size={24} />
            Safety Tips During Floods
          </h2>
          <p className="section-subtitle">Be prepared and stay safe</p>
          
          <div className="tips-grid">
            {safetyTips.map((tip, index) => (
              <div key={index} className="tip-card">
                <div className="tip-icon">{tip.icon}</div>
                <h3>{tip.title}</h3>
                <p>{tip.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Important Information */}
        <section className="emergency-section">
          <h2>Important Information</h2>
          
          <div className="info-box">
            <h3>What to do in a flood emergency:</h3>
            <ul>
              <li>Move to higher ground immediately</li>
              <li>Turn off electricity and gas supplies if safe</li>
              <li>Avoid walking or driving through floodwaters</li>
              <li>Keep emergency supplies ready (water, food, medicines)</li>
              <li>Stay informed through official channels</li>
              <li>Help vulnerable people reach safety</li>
              <li>Document damages for insurance claims</li>
            </ul>
          </div>

          <div className="info-box">
            <h3>After the flood:</h3>
            <ul>
              <li>Check for structural damage to buildings</li>
              <li>Avoid contaminated water and food</li>
              <li>Report issues to Municipal Corporation</li>
              <li>Seek medical help for injuries or illnesses</li>
              <li>Contact insurance companies for claims</li>
              <li>Share feedback with emergency services</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
