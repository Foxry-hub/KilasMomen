model Frame {

&#x20; id            String         @id @default(cuid())

&#x20; name          String

&#x20; slug          String         @unique

&#x20; canvasWidth   Int            @default(1200)

&#x20; canvasHeight  Int            @default(1800)

&#x20; slotCount     Int            @default(2)

&#x20; slotsConfig   String

&#x20; overlayPath   String

&#x20; isActive      Boolean        @default(true)

&#x20; sessions      PhotoSession\[]

}



model Transaction {

&#x20; id            String        @id @default(cuid())

&#x20; code          String        @unique

&#x20; amount        Int

&#x20; paymentMethod String?

&#x20; status        String        @default("PENDING") // PENDING, PAID, CANCELLED, EXPIRED, COMPLETED

&#x20; createdAt     DateTime      @default(now())

&#x20; expiresAt     DateTime

&#x20; confirmedAt   DateTime?

&#x20; session       PhotoSession?

}



model PhotoSession {

&#x20; id              String      @id @default(cuid())

&#x20; transactionId   String      @unique

&#x20; frameId         String?

&#x20; status          String      @default("FRAME\_SELECT")

&#x20; filter          String      @default("ORIGINAL")

&#x20; finalImagePath  String?

&#x20; transaction     Transaction @relation(fields: \[transactionId], references: \[id])

&#x20; frame           Frame?      @relation(fields: \[frameId], references: \[id])

&#x20; photos          Photo\[]

&#x20; invoice         Invoice?

&#x20; printJobs       PrintJob\[]

}



model Photo {

&#x20; id            String       @id @default(cuid())

&#x20; sessionId     String

&#x20; shotIndex     Int

&#x20; filePath      String

&#x20; selectedOrder Int?

&#x20; session       PhotoSession @relation(fields: \[sessionId], references: \[id], onDelete: Cascade)

}



model Invoice {

&#x20; id            String       @id @default(cuid())

&#x20; invoiceNumber String       @unique

&#x20; sessionId     String       @unique

&#x20; token         String       @unique

&#x20; createdAt     DateTime     @default(now())

&#x20; expiresAt     DateTime

&#x20; session       PhotoSession @relation(fields: \[sessionId], references: \[id], onDelete: Cascade)

}



model PrintJob {

&#x20; id           String       @id @default(cuid())

&#x20; sessionId    String

&#x20; copies       Int          @default(1)

&#x20; status       String       @default("QUEUED") // QUEUED, SENT, FAILED

&#x20; createdAt    DateTime     @default(now())

&#x20; session      PhotoSession @relation(fields: \[sessionId], references: \[id], onDelete: Cascade)

}

