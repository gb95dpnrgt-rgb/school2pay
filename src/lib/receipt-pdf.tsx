import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 48,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 16,
  },
  schoolName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
  },
  receiptLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  label: {
    color: "#6b7280",
    flex: 1,
  },
  value: {
    fontFamily: "Helvetica-Bold",
    flex: 2,
    textAlign: "right",
  },
  amountBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 4,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 12,
    color: "#1e40af",
    fontFamily: "Helvetica-Bold",
  },
  amountValue: {
    fontSize: 20,
    color: "#1e40af",
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    marginTop: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    color: "#9ca3af",
    fontSize: 8,
    textAlign: "center",
  },
  refNote: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    fontSize: 9,
    color: "#6b7280",
  },
});

export interface ReceiptData {
  schoolName: string;
  requestTitle: string;
  studentName: string;
  guardianEmail: string;
  amountPence: number;
  transactionId: string;
  paidAt: Date;
}

function Receipt({ data }: { data: ReceiptData }) {
  const amount = `£${(data.amountPence / 100).toFixed(2)}`;
  const dateStr = data.paidAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = data.paidAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const ref = data.transactionId.slice(0, 8).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.schoolName}</Text>
          <Text style={styles.receiptLabel}>Payment Receipt</Text>
        </View>

        {/* Payment details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Payment for</Text>
            <Text style={styles.value}>{data.requestTitle}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Student</Text>
            <Text style={styles.value}>{data.studentName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Paid by</Text>
            <Text style={styles.value}>{data.guardianEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{dateStr} at {timeStr}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reference</Text>
            <Text style={styles.value}>S2P-{ref}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment method</Text>
            <Text style={styles.value}>Card (via Stripe)</Text>
          </View>
        </View>

        {/* Amount box */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount paid</Text>
          <Text style={styles.amountValue}>{amount}</Text>
        </View>

        {/* Note for records */}
        <View style={styles.refNote}>
          <Text>
            Please keep this receipt for your records. If you pay for childcare or wraparound care, this document can be used as evidence of payment for Universal Credit childcare cost claims.
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Issued by {data.schoolName} via School2Pay · school2pay.com · Transaction ref: S2P-{ref}
        </Text>
      </Page>
    </Document>
  );
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<Receipt data={data} />);
}
