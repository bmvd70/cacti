package org.hyperledger.cactus.plugin.ledger.connector.corda.server.model

import java.util.Objects
import com.fasterxml.jackson.annotation.JsonProperty
import org.hyperledger.cactus.plugin.ledger.connector.corda.server.model.CordaX500Name
import org.hyperledger.cactus.plugin.ledger.connector.corda.server.model.PublicKey
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
 * @param name 
 * @param owningKey 
 */
data class Party(

    @field:Valid
    @Schema(example = "null", required = true, description = "")
    @get:JsonProperty("name", required = true) val name: CordaX500Name,

    @field:Valid
    @Schema(example = "null", required = true, description = "")
    @get:JsonProperty("owningKey", required = true) val owningKey: PublicKey
) {

}

