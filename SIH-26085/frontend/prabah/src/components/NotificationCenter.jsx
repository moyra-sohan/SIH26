import { useState } from 'react';
import { Bell, X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import '../styles/notifications.css';

function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'warning',
      title: 'High Flood Risk Alert',
      message: 'Rainfall intensity expected to increase in the next 2 hours. Prepare evacuation plans.',
      time: '5 mins ago',
    },
    {
      id: 2,
      type: 'info',
      title: 'System Update',
      message: 'Real-time data refreshed. New weather parameters available.',
      time: '15 mins ago',
    },
    {
      id: 3,
      type: 'success',
      title: 'Prediction Model Updated',
      message: 'AI nowcasting model has been updated with latest satellite data.',
      time: '32 mins ago',
    },
  ]);

  const [unreadCount, setUnreadCount] = useState(notifications.length);

  const toggleNotifications = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const closeNotifications = () => {
    setIsOpen(false);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'warning':
        return <AlertCircle size={18} />;
      case 'success':
        return <CheckCircle size={18} />;
      case 'info':
      default:
        return <Info size={18} />;
    }
  };

  const getNotificationClass = (type) => {
    return `notification-item notification-${type}`;
  };

  return (
    <div className="notification-center">
      {/* Bell Icon Button */}
      <button
        className="notification-bell-btn"
        onClick={toggleNotifications}
        aria-label="Notifications"
        id="notification-bell"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* Notification Popup Panel */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div className="notification-overlay" onClick={closeNotifications} />

          {/* Notification Panel */}
          <div className="notification-panel">
            {/* Header */}
            <div className="notification-panel-header">
              <h3>Notifications</h3>
              <button
                className="notification-close-btn"
                onClick={closeNotifications}
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>

            {/* Divider */}
            <div className="notification-divider" />

            {/* Notifications List */}
            <div className="notification-list">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} className={getNotificationClass(notif.type)}>
                    <div className="notification-icon">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">{notif.title}</div>
                      <div className="notification-message">{notif.message}</div>
                      <div className="notification-time">{notif.time}</div>
                    </div>
                    <button
                      className="notification-remove-btn"
                      onClick={() => removeNotification(notif.id)}
                      aria-label="Remove notification"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="notification-empty">
                  <Bell size={32} />
                  <p>No notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="notification-panel-footer">
                <button
                  className="notification-clear-all-btn"
                  onClick={clearAllNotifications}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationCenter;
