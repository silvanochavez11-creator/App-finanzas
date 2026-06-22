import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useFmt } from "../format.js";

export default function ProjectionChart({ data, target }) {
  const fmt = useFmt();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#29323f" />
        <XAxis dataKey="month" stroke="#8a93a3" fontSize={11} label={{ value: "meses", position: "insideBottom", offset: -3, fill: "#5a6372", fontSize: 11 }} />
        <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={{ background: "#1c2433", border: "1px solid #29323f", borderRadius: 8 }} formatter={(v) => fmt(v)} labelFormatter={(l) => `Mes ${l}`} />
        <Line type="monotone" dataKey="balance" stroke="#d4af37" strokeWidth={2.5} dot={false} />
        {target ? <Line type="monotone" dataKey={() => target} stroke="#e25c5c" strokeDasharray="4 4" dot={false} name="Meta" /> : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
