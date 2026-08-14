import React, { createContext, useContext, useState } from 'react';

const PanelContext = createContext(null);

export const PanelProvider = ({ children }) => {
  const [leftPanel, setLeftPanel] = useState('inbox');
  const [leftPanelParams, setLeftPanelParams] = useState(null);
  const [panelHistory, setPanelHistory] = useState([]);

  const navigatePanel = (panel, params = null) => {
    setPanelHistory(prev => [...prev, { panel: leftPanel, params: leftPanelParams }]);
    setLeftPanel(panel);
    setLeftPanelParams(params);
  };

  const goBackPanel = () => {
    if (panelHistory.length === 0) {
      setLeftPanel('inbox');
      setLeftPanelParams(null);
      return;
    }
    const prev = panelHistory[panelHistory.length - 1];
    setPanelHistory(h => h.slice(0, -1));
    setLeftPanel(prev.panel);
    setLeftPanelParams(prev.params);
  };

  const resetPanel = () => {
    setLeftPanel('inbox');
    setLeftPanelParams(null);
    setPanelHistory([]);
  };

  return (
    <PanelContext.Provider value={{ 
      leftPanel, 
      leftPanelParams, 
      panelHistory,
      navigatePanel, 
      goBackPanel, 
      resetPanel 
    }}>
      {children}
    </PanelContext.Provider>
  );
};

export const usePanel = () => useContext(PanelContext);
