import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { meet } from '@googleworkspace/meet-addons/meet.addons';
import { BoardApp } from '../App';

const MainStageContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  background-color: #f5f5f5;
  position: relative;
`;

const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const LoadingText = styled.div`
  font-size: 16px;
  color: #5f6368;
`;

const ErrorContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const ErrorText = styled.div`
  font-size: 16px;
  color: #d93025;
  text-align: center;
`;

const MeetMainStage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const initializeMeetSession = async () => {
      try {
        // Replace with your actual GCP project number
        const session = await meet.addon.createAddonSession({
          cloudProjectNumber: process.env.REACT_APP_GCP_PROJECT_NUMBER || 'YOUR_GCP_PROJECT_NUMBER'
        });
        
        await session.createMainStageClient();
        console.log('✅ Google Meet main stage initialized');
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize Meet main stage session:', err);
        setError('Failed to initialize Google Meet integration');
        setIsLoading(false);
      }
    };

    initializeMeetSession();
  }, []);

  if (isLoading) {
    return (
      <LoadingContainer>
        <LoadingText>Initializing MedForce Board for Google Meet...</LoadingText>
      </LoadingContainer>
    );
  }

  if (error) {
    return (
      <ErrorContainer>
        <ErrorText>
          {error}
          <br />
          <br />
          Please check your Google Meet add-on configuration.
        </ErrorText>
      </ErrorContainer>
    );
  }

  // Render the full BoardApp component (same as / route)
  return <BoardApp />;
};

export default MeetMainStage;