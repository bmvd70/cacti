package org.hyperledger.cactus.plugin.ledger.connector.corda.server.model

import java.util.Objects
import com.fasterxml.jackson.annotation.JsonProperty
import javax.validation.constraints.DecimalMax
import javax.validation.constraints.DecimalMin
import javax.validation.constraints.Email
import javax.validation.constraints.Max
import javax.validation.constraints.Min
import javax.validation.constraints.NotNull
import javax.validation.constraints.Pattern
import javax.validation.constraints.Size
import javax.validation.Valid
import io.swagger.v3.oas.annotations.media.Schema

/**
 * 
 * @param index 
 * @param &#x60;data&#x60; 
 */
data class GetMonitorTransactionsV1ResponseTxInner(

    @Schema(example = "null", description = "")
    @get:JsonProperty("index") val index: kotlin.String? = null,

    @Schema(example = "null", description = "")
    @get:JsonProperty("data") val `data`: kotlin.String? = null
) {

}

