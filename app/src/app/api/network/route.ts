import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const interfaces = os.networkInterfaces();
  let localIp = "localhost";
  const allIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        allIps.push(iface.address);
        // Prioritize common Wi-Fi/LAN IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (
          localIp === "localhost" ||
          iface.address.startsWith("192.168.") ||
          iface.address.startsWith("10.")
        ) {
          localIp = iface.address;
        }
      }
    }
  }

  return NextResponse.json({
    ip: localIp,
    allIps,
    port: 3000,
    baseUrl: `http://${localIp}:3000`,
  });
}
