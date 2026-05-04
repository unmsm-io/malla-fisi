import { MallaBuilder } from "@/components/MallaBuilder";
import data from "@/data/courses.json";
import type { CoursesData } from "@/lib/types";

export default function Home() {
  return <MallaBuilder data={data as CoursesData} />;
}
