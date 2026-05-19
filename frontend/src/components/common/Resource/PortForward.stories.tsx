/*
 * Copyright 2025 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PortForwardState } from '../../../lib/k8s/api/v1/portForward';
import Pod from '../../../lib/k8s/pod';
import Service from '../../../lib/k8s/service';
import PortForward, { PORT_FORWARD_RUNNING_STATUS } from './PortForward';

// Mocking isElectron and isDockerDesktop for Storybook
jest.mock('../../../helpers/isElectron', () => ({
  isElectron: () => true,
}));

jest.mock('../../../helpers/isDockerDesktop', () => ({
  isDockerDesktop: () => false,
}));

jest.mock('../../../lib/k8s/api/v1/portForward', () => ({
  listPortForward: jest.fn(() => Promise.resolve([])),
  startPortForward: jest.fn(() => Promise.resolve({})),
  stopOrDeletePortForward: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../../lib/cluster', () => ({
  getCluster: jest.fn(() => 'test-cluster'),
}));

jest.mock('../../../lib/k8s/pod', () => {
  const actualPod = jest.requireActual('../../../lib/k8s/pod').default;
  return {
    __esModule: true,
    default: class MockPod extends actualPod {
      static useList = jest.fn(() => [
        [
          {
            metadata: {
              name: 'test-pod',
              namespace: 'test-namespace',
            },
            spec: {
              containers: [
                { name: 'test-container', ports: [{ containerPort: 80, name: 'http' }] },
              ],
            },
            status: {
              phase: 'Running',
            },
          } as Pod,
        ],
        null,
      ]);
    },
  };
});

jest.mock('../../portforward/PortForwardStartDialog', () => ({
  __esModule: true,
  default: ({ open, onCancel, onConfirm, defaultPort }: any) => {
    if (!open) return null;
    return (
      <div
        style={{
          border: '1px solid black',
          padding: '20px',
          backgroundColor: 'white',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
        }}
      >
        <p>Mock PortForwardStartDialog</p>
        <p>Default Port: {defaultPort}</p>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={() => onConfirm('8080')}>Confirm</button>
      </div>
    );
  },
}));

export default {
  title: 'Resource/PortForward',
  component: PortForward,
  decorators: [
    Story => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  args: {
    containerPort: 80,
    resource: new Pod({
      metadata: { name: 'test-pod', namespace: 'test-namespace' },
      spec: {
        containers: [{ name: 'test-container', ports: [{ containerPort: 80, name: 'http' }] }],
      },
      status: {
        phase: 'Running',
      },
    }),
  },
} as Meta<typeof PortForward>;

const Template: StoryFn<typeof PortForward> = args => <PortForward {...args} />;

// Default state: Port forward form
export const DefaultForm = Template.bind({});
DefaultForm.args = {
  containerPort: 80,
  resource: new Pod({
    metadata: { name: 'test-pod', namespace: 'test-namespace' },
    spec: {
      containers: [{ name: 'test-container', ports: [{ containerPort: 80, name: 'http' }] }],
    },
    status: {
      phase: 'Running',
    },
  }),
};
DefaultForm.parameters = {
  chromatic: { delay: 100 },
  docs: {
    description: {
      story: 'The initial state, showing the "Forward port" button.',
    },
  },
};

// Connection pending loading state
export const ConnectionPending = Template.bind({});
ConnectionPending.args = {
  ...DefaultForm.args,
};
ConnectionPending.play = async () => {
  const { listPortForward, startPortForward } = await import('../../../lib/k8s/api/v1/portForward');

  (listPortForward as jest.Mock).mockResolvedValue([]);
  (startPortForward as jest.Mock).mockImplementation(
    () =>
      new Promise(() => {
        // Simulate a pending connection
      })
  );

  // We mock the onConfirm to trigger the loading state logically in the component
  // In a real Storybook play function, we would use userEvent to click the button
};

ConnectionPending.parameters = {
  chromatic: { delay: 100 },
  docs: {
    description: {
      story: 'State showing a loading spinner when a port forward connection is pending.',
    },
  },
};

// Connection established success
export const ConnectionEstablished = Template.bind({});
ConnectionEstablished.args = {
  ...DefaultForm.args,
};
ConnectionEstablished.play = async () => {
  const { listPortForward } = await import('../../../lib/k8s/api/v1/portForward');
  (listPortForward as jest.Mock).mockResolvedValue([
    {
      id: 'mock-id',
      pod: 'test-pod',
      namespace: 'test-namespace',
      cluster: 'test-cluster',
      targetPort: '80',
      port: '8080',
      status: PORT_FORWARD_RUNNING_STATUS,
    } as PortForwardState,
  ]);
};
ConnectionEstablished.parameters = {
  chromatic: { delay: 100 },
  docs: {
    description: {
      story: 'State showing the port forward connection is established and running.',
    },
  },
};

// Connection failed error state
export const ConnectionFailed = Template.bind({});
ConnectionFailed.args = {
  ...DefaultForm.args,
};
ConnectionFailed.play = async () => {
  const { listPortForward, startPortForward } = await import('../../../lib/k8s/api/v1/portForward');
  (listPortForward as jest.Mock).mockResolvedValue([]);
  (startPortForward as jest.Mock).mockRejectedValue(new Error('Failed to connect to port.'));
};
ConnectionFailed.parameters = {
  chromatic: { delay: 100 },
  docs: {
    description: {
      story: 'State showing an error when a port forward connection fails.',
    },
  },
};

// Port already in use error state
export const PortAlreadyInUse = Template.bind({});
PortAlreadyInUse.args = {
  ...DefaultForm.args,
};
PortAlreadyInUse.play = async () => {
  const { listPortForward, startPortForward } = await import('../../../lib/k8s/api/v1/portForward');
  (listPortForward as jest.Mock).mockResolvedValue([]);
  (startPortForward as jest.Mock).mockRejectedValue(new Error('Port 8080 is already in use.'));
};
PortAlreadyInUse.parameters = {
  chromatic: { delay: 100 },
  docs: {
    description: {
      story: 'State showing an error when the requested port is already in use.',
    },
  },
};

// Service Resource Example
export const WithServiceResource = Template.bind({});
WithServiceResource.args = {
  containerPort: 80,
  resource: new Service({
    metadata: { name: 'test-service', namespace: 'test-namespace' },
    spec: {
      selector: {
        app: 'test-app',
      },
      ports: [{ port: 80, targetPort: 80 }],
    },
  }),
};
WithServiceResource.parameters = {
  chromatic: { delay: 100 },
  docs: {
    description: {
      story: 'Example of PortForward with a Service resource.',
    },
  },
};
