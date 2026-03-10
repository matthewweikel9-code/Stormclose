import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deletePlaceholderLeads() {
  console.log("Deleting placeholder leads...");

  // Delete leads with placeholder addresses
  const { data: deleted1, error: error1 } = await supabaseAdmin
    .from("leads")
    .delete()
    .like("address", "Property in % area")
    .select("id");

  if (error1) {
    console.error("Error deleting 'Property in' leads:", error1);
  } else {
    console.log(`Deleted ${deleted1?.length || 0} 'Property in' leads`);
  }

  const { data: deleted2, error: error2 } = await supabaseAdmin
    .from("leads")
    .delete()
    .like("address", "Storm-affected property in %")
    .select("id");

  if (error2) {
    console.error("Error deleting 'Storm-affected' leads:", error2);
  } else {
    console.log(`Deleted ${deleted2?.length || 0} 'Storm-affected' leads`);
  }

  console.log("Done!");
}

deletePlaceholderLeads();
