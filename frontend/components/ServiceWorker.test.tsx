import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerServiceWorker, ServiceWorker } from "@/components/ServiceWorker";

type Listener = () => void;

function fakeRegistration(options: { controller: boolean }) {
  const workerListeners: Record<string, Listener> = {};
  const registrationListeners: Record<string, Listener> = {};
  const worker = {
    state: "installing",
    addEventListener: (name: string, fn: Listener) => {
      workerListeners[name] = fn;
    },
  };
  const registration = {
    installing: worker,
    addEventListener: (name: string, fn: Listener) => {
      registrationListeners[name] = fn;
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue(registration),
      controller: options.controller ? {} : null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  return {
    fireUpdate() {
      registrationListeners.updatefound();
      worker.state = "installed";
      workerListeners.statechange();
    },
  };
}

describe("registerServiceWorker", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("does nothing when the browser has no service worker support", async () => {
    await expect(registerServiceWorker(() => {})).resolves.toBeNull();
  });

  it("registers /sw.js and reports an update when a new worker is installed", async () => {
    const fake = fakeRegistration({ controller: true });
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    fake.fireUpdate();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not report the very first installation as an update", async () => {
    const fake = fakeRegistration({ controller: false });
    const onUpdate = vi.fn();
    await registerServiceWorker(onUpdate);
    fake.fireUpdate();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("ServiceWorker component", () => {
  it("renders nothing outside production", () => {
    const { container } = render(<ServiceWorker />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
