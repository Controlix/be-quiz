import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilitiesProvider, useCapabilities } from "@/features/capabilities/CapabilitiesContext";

function TestConsumer() {
  const caps = useCapabilities();
  return (
    <div data-testid="caps">
      vision:{String(caps.vision)},icalExport:{String(caps.icalExport)},whatsappShare:
      {String(caps.whatsappShare)},emailRegistration:{String(caps.emailRegistration)}
      ,sharedGoogleCalendar:{String(caps.sharedGoogleCalendar)}
    </div>
  );
}

describe("CapabilitiesContext", () => {
  it("provides capabilities to child components", () => {
    const mockCaps = {
      vision: true,
      icalExport: false,
      whatsappShare: true,
      emailRegistration: false,
      sharedGoogleCalendar: false,
    };

    const html = renderToStaticMarkup(
      <CapabilitiesProvider capabilities={mockCaps}>
        <TestConsumer />
      </CapabilitiesProvider>
    );

    expect(html).toContain(
      "vision:true,icalExport:false,whatsappShare:true,emailRegistration:false,sharedGoogleCalendar:false"
    );
  });

  it("returns default all-false capabilities when outside provider", () => {
    const html = renderToStaticMarkup(<TestConsumer />);
    expect(html).toContain(
      "vision:false,icalExport:false,whatsappShare:false,emailRegistration:false,sharedGoogleCalendar:false"
    );
  });
});
