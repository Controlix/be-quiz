"use client";

import React, { createContext, useContext } from "react";
import { AppCapabilities } from "./types";

const defaultCapabilities: AppCapabilities = {
  vision: false,
  icalExport: false,
  whatsappShare: false,
  emailRegistration: false,
};

const CapabilitiesContext = createContext<AppCapabilities>(defaultCapabilities);

export const CapabilitiesProvider: React.FC<{
  capabilities: AppCapabilities;
  children: React.ReactNode;
}> = ({ capabilities, children }) => {
  return (
    <CapabilitiesContext.Provider value={capabilities}>
      {children}
    </CapabilitiesContext.Provider>
  );
};

export function useCapabilities(): AppCapabilities {
  return useContext(CapabilitiesContext);
}
